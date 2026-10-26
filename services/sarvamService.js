/**
 * Sarvam AI Service Integration
 * Handles:
 * 1. Document AI / Vision (Menu Image Digitization via https://api.sarvam.ai/doc-ai/v1/job/digitise)
 * 2. Chat Completion (sarvam-105b-conversations for Culinary Allergen, Calorie & Taste Advisory)
 * 3. Resilient JSON Auto-Repair for truncated responses
 */

const SARVAM_BASE_URL = "https://api.sarvam.ai";

/**
 * Make a chat completion request to Sarvam AI (sarvam-105b-conversations)
 */
export async function callSarvamChat({
  messages,
  model = "sarvam-105b-conversations",
  temperature = 0.2,
  max_tokens = 4096
}) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw new Error("SARVAM_API_KEY is missing. Please set it in your .env file.");
  }

  const response = await fetch(`${SARVAM_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sarvam API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Digitizes a menu image using Sarvam's Document AI / Vision API
 */
export async function digitizeMenuImage(buffer, mimeType = "image/jpeg", language = "en-IN") {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw new Error("SARVAM_API_KEY is missing.");
  }

  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append("file", blob, "menu_photo.jpg");
  formData.append("language", language);
  formData.append("content_type", "printed");
  formData.append("model", "sarvam-vision-v1");

  const startJobRes = await fetch(`${SARVAM_BASE_URL}/doc-ai/v1/job/digitise`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey
    },
    body: formData
  });

  if (!startJobRes.ok) {
    const errText = await startJobRes.text();
    throw new Error(`Sarvam Document AI start error (${startJobRes.status}): ${errText}`);
  }

  const jobData = await startJobRes.json();
  const jobId = jobData.job_id;
  if (!jobId) {
    throw new Error("Failed to obtain job_id from Sarvam Document AI.");
  }

  // Poll status up to 35 seconds
  const startTime = Date.now();
  while (Date.now() - startTime < 35000) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const statusRes = await fetch(`${SARVAM_BASE_URL}/doc-ai/v1/job/${jobId}/status`, {
      headers: { "api-subscription-key": apiKey }
    });

    if (statusRes.ok) {
      const statusData = await statusRes.json();
      const status = (statusData.status || "").toLowerCase();

      if (status === "completed") {
        const resultsRes = await fetch(`${SARVAM_BASE_URL}/doc-ai/v1/job/${jobId}/results`, {
          headers: { "api-subscription-key": apiKey }
        });
        if (resultsRes.ok) {
          const results = await resultsRes.json();
          const textBlocks = [];
          if (Array.isArray(results.pages)) {
            for (const page of results.pages) {
              if (page.text) textBlocks.push(page.text);
              if (page.blocks) {
                for (const b of page.blocks) {
                  if (b.text) textBlocks.push(b.text);
                }
              }
            }
          }
          return textBlocks.join("\n") || JSON.stringify(results);
        }
      } else if (status === "failed" || status === "rejected") {
        throw new Error(`Sarvam Document AI job ended with status: ${status}`);
      }
    }
  }

  throw new Error("Document digitization timed out. Please try again or paste the menu text directly.");
}

/**
 * Resilient JSON Parser that auto-repairs truncated LLM responses
 */
function safeParseJson(rawString, userAllergens = [], calorieGoal = 650) {
  let str = (rawString || "").trim();

  // 1. Strip markdown fences
  if (str.startsWith("```")) {
    str = str.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  // 2. Try direct JSON.parse
  try {
    const parsed = JSON.parse(str);
    return normalizeParsedOutput(parsed, userAllergens, calorieGoal);
  } catch (err) {
    // 3. Attempt structural repair (unclosed strings, dangling keys, unbalanced braces)
    try {
      const repaired = repairTruncatedJsonString(str);
      const parsed = JSON.parse(repaired);
      return normalizeParsedOutput(parsed, userAllergens, calorieGoal);
    } catch (err2) {
      // 4. Fallback: Extract all completed objects and assemble valid payload
      return extractPartialPayload(str, userAllergens, calorieGoal);
    }
  }
}

/**
 * Repairs unclosed quotes, dangling commas, and unclosed braces/brackets
 */
function repairTruncatedJsonString(str) {
  let repaired = str;

  // Check if string ends inside a quoted literal
  let inString = false;
  let escaped = false;
  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (char === "\\" && inString) {
      escaped = !escaped;
    } else if (char === "\"" && !escaped) {
      inString = !inString;
    } else {
      escaped = false;
    }
  }
  if (inString) {
    repaired += "\"";
  }

  // Strip trailing dangling keys or colons, e.g. , "field": or , "field"
  repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*"?$/, "");
  repaired = repaired.replace(/,\s*"[^"]*"?$/, "");
  repaired = repaired.replace(/,\s*$/, "");

  // Balance open braces and brackets
  const stack = [];
  inString = false;
  escaped = false;
  for (let i = 0; i < repaired.length; i++) {
    const c = repaired[i];
    if (c === "\\" && inString) {
      escaped = !escaped;
    } else if (c === "\"" && !escaped) {
      inString = !inString;
    } else if (!inString) {
      if (c === "{" || c === "[") stack.push(c);
      else if (c === "}" && stack[stack.length - 1] === "{") stack.pop();
      else if (c === "]" && stack[stack.length - 1] === "[") stack.pop();
    } else {
      escaped = false;
    }
  }

  while (stack.length > 0) {
    const open = stack.pop();
    repaired += (open === "{" ? "}" : "]");
  }

  return repaired;
}

/**
 * Fallback parser that regex-extracts whatever dishes and summary were generated
 */
function extractPartialPayload(str, userAllergens, calorieGoal) {
  const summaryMatch = str.match(/"summary"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  const summary = summaryMatch ? summaryMatch[1] : "Menu allergen & calorie analysis completed.";

  const dishes = [];
  const matches = str.match(/\{[^{}]*"name"[^{}]*\}/g) || [];
  for (const m of matches) {
    try {
      dishes.push(JSON.parse(m));
    } catch (e) {
      // Ignore unparseable fragments
    }
  }

  return normalizeParsedOutput({ summary, dishes }, userAllergens, calorieGoal);
}

/**
 * Ensures dishes, calorie data, meal combo, top recommendations, and waiter card are present
 */
function normalizeParsedOutput(parsed, userAllergens, calorieGoal) {
  if (!parsed || typeof parsed !== "object") {
    parsed = {};
  }

  if (!parsed.summary) {
    parsed.summary = "Allergen & nutritional review complete. View dishes below grouped by course.";
  }

  if (!Array.isArray(parsed.dishes)) {
    parsed.dishes = [];
  }

  // Normalize each dish category and calorie data
  for (const dish of parsed.dishes) {
    if (!dish.category) dish.category = "Main";
    if (!dish.estimated_calories) {
      const cat = (dish.category || "").toLowerCase();
      if (cat.includes("starter") || cat.includes("snack") || cat.includes("appetizer")) dish.estimated_calories = 260;
      else if (cat.includes("bread") || cat.includes("roti") || cat.includes("naan")) dish.estimated_calories = 180;
      else if (cat.includes("dessert") || cat.includes("sweet")) dish.estimated_calories = 340;
      else if (cat.includes("beverage") || cat.includes("drink")) dish.estimated_calories = 140;
      else dish.estimated_calories = 480;
    }
  }

  // Derive top recommendations from SAFE dishes
  if (!Array.isArray(parsed.top_recommendations) || parsed.top_recommendations.length === 0) {
    const safeDishes = parsed.dishes
      .filter((d) => (d.safety_status || "").toUpperCase() === "SAFE")
      .sort((a, b) => (b.taste_score || 0) - (a.taste_score || 0))
      .slice(0, 3);

    parsed.top_recommendations = safeDishes.map((d) => ({
      name: d.name,
      reason: d.taste_profile_notes || `Allergen-safe (${d.estimated_calories} kcal) matching your preferences.`
    }));
  }

  // Derive recommended meal combo if missing
  if (!parsed.recommended_meal_combo || !parsed.recommended_meal_combo.items) {
    const safeMains = parsed.dishes.filter(
      (d) => (d.safety_status || "").toUpperCase() === "SAFE" && !d.category.toLowerCase().includes("dessert")
    );
    if (safeMains.length > 0) {
      const topPick = safeMains[0];
      const secondPick = safeMains.find((d) => d.name !== topPick.name && (topPick.estimated_calories + d.estimated_calories) <= (Number(calorieGoal) + 100));
      const items = secondPick ? [topPick.name, secondPick.name] : [topPick.name];
      const totalCal = items.reduce((sum, n) => {
        const item = parsed.dishes.find((d) => d.name === n);
        return sum + (item ? item.estimated_calories : 400);
      }, 0);

      parsed.recommended_meal_combo = {
        meal_name: "Safe & Balanced Meal Combo",
        items,
        total_calories: totalCal,
        fit_reason: `Tailored safe combo within your ~${calorieGoal} kcal target.`
      };
    }
  }

  // Waiter Safety Card fallback
  if (!parsed.waiter_safety_card || !parsed.waiter_safety_card.english) {
    const allergenList = userAllergens.length > 0 ? userAllergens.join(", ") : "strict food allergies";
    parsed.waiter_safety_card = {
      english: `I have severe allergies to: ${allergenList}. Please ensure no butter, ghee, compounded hing (wheat), or nut pastes are used in my food.`,
      local_language: `मुझे इन चीज़ों से गंभीर एलर्जी है: ${allergenList}। कृपया भोजन में मक्खन, घी, हींग (गेहूं) या मेवे का पेस्ट इस्तेमाल न करें।`
    };
  }

  return parsed;
}

/**
 * Comprehensive Food, Allergen, Calorie & Taste Advisor Prompt
 */
export async function analyzeMenu({
  menuText,
  allergens = [],
  dietaryRestrictions = [],
  tastePreferences = [],
  preferredLanguage = "English",
  calorieGoal = 650,
  mealType = "Lunch",
  favoriteDishes = "",
  dietaryGoals = []
}) {
  const systemPrompt = `You are "SwaadSafe", an elite computational gastronomy chef, clinical nutritionist, and food safety scientist specializing in Indian and global cuisines.

CONCISENESS MANDATE (CRITICAL):
- Keep all explanations concise (1 short sentence per field max).
- Do NOT write essays or verbose descriptions.
- Ensure the JSON is compact and complete.

YOUR TASKS:
1. NUTRITION & CALORIE ESTIMATION:
   - Estimate standard restaurant portion calories for each dish ("estimated_calories": number, e.g. 420).
   - Evaluate calorie fit against the user's meal calorie goal (${calorieGoal} kcal).
   - Identify macro highlights ("macro_highlight": "High Protein" | "Low Carb" | "Balanced" | "Carb-Rich" | "Healthy Fats").

2. FAVORITE DISHES BENCHMARKING:
   - If user listed favorite dishes, compare menu items for flavor pairing, gravy base, texture, or spicing similarity.
   - Set "favorite_similarity_note" (e.g. "Similar rich makhani profile to your favorite Butter Chicken" or null if no connection).

3. MEAL TIME & COURSE CLASSIFICATION:
   - Categorize each dish into: "Starter" | "Main" | "Bread" | "Rice" | "Dessert" | "Beverage".
   - Note if it is suitable for "${mealType}" (Breakfast, Lunch, Dinner, Snack).

4. RECOMMENDED MEAL COMBO:
   - Build a recommended meal combo for "${mealType}" (e.g. 1 Starter + 1 Main, or 1 Main + 1 Bread) that is:
     * 100% SAFE for their allergens.
     * Stays within or very close to their target ${calorieGoal} kcal.
     * Matches their taste preferences and favorite dishes.

5. HIDDEN REGIONAL ALLERGENS TO WATCH:
   - GLUTEN: Compounded Hing (contains maida/wheat), Sooji/Rava, gravies thickened with maida.
   - NUTS: Cashew/melon-seed paste in Shahi/Korma/Makhani gravies; peanut powder in Maharashtrian dishes.
   - DAIRY: Ghee in dal tadka, curd in marinades, butter on breads, paneer, cream.
   - MUSTARD/SESAME: Mustard oil in Eastern dishes, mustard seeds in South Indian tadkas, sesame in podis.
   - SOY/EGGS: Soy sauce in Indo-Chinese; egg wash on breads.

OUTPUT FORMAT:
Return strictly a valid, compact JSON object matching this schema:
{
  "summary": "Brief 1-2 sentence safety & calorie summary",
  "recommended_meal_combo": {
    "meal_name": "Combo Name (e.g. High-Protein Safe Lunch)",
    "items": ["Dish Name 1", "Dish Name 2"],
    "total_calories": 580,
    "fit_reason": "1 sentence why this combo fits their ${calorieGoal} kcal goal and taste"
  },
  "dishes": [
    {
      "name": "Dish name",
      "category": "Starter | Main | Bread | Rice | Dessert | Beverage",
      "safety_status": "SAFE" | "CAUTION" | "UNSAFE",
      "estimated_calories": 420,
      "macro_highlight": "High Protein | Balanced | Low Carb | Carb-Rich",
      "detected_allergens": ["Allergen 1"],
      "hidden_allergen_alert": "Brief 1-sentence note on where allergen lurks (or 'None detected')",
      "taste_score": 85,
      "favorite_similarity_note": "Brief note if similar to their favorites (or null)",
      "taste_profile_notes": "1 brief sentence on flavor match",
      "can_customize": true,
      "customization_request": "Short kitchen modification request in English",
      "customization_request_local": "Short polite kitchen request in ${preferredLanguage}"
    }
  ],
  "top_recommendations": [
    {
      "name": "Dish Name",
      "reason": "1 short sentence why safe, calorie-smart, and tasty"
    }
  ],
  "waiter_safety_card": {
    "english": "Concise bullet points for the waiter",
    "local_language": "Concise bullet points in ${preferredLanguage} to show the chef"
  }
}`;

  const userPrompt = `USER PROFILE:
- Allergens to avoid: ${allergens.length > 0 ? allergens.join(", ") : "None reported"}
- Dietary Restrictions: ${dietaryRestrictions.length > 0 ? dietaryRestrictions.join(", ") : "Any"}
- Nutritional Goals: ${dietaryGoals.length > 0 ? dietaryGoals.join(", ") : "Balanced"}
- Target Meal Calories: ~${calorieGoal} kcal
- Meal of the Day: ${mealType}
- User's Favorite Dishes: ${favoriteDishes ? favoriteDishes : "None specified"}
- Taste Preferences: ${tastePreferences.length > 0 ? tastePreferences.join(", ") : "Balanced"}
- Preferred Language: ${preferredLanguage}

MENU TO ANALYZE:
"""
${menuText}
"""

Analyze each dish concisely. Output pure JSON only.`;

  const rawReply = await callSarvamChat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.1,
    max_tokens: 4096
  });

  return safeParseJson(rawReply, allergens, calorieGoal);
}
