/**
 * Foodoscope Computational Gastronomy Service
 * Reference: https://www.foodoscope.com/ (RecipeDB, FlavorDB, DietRx)
 *
 * Provides recipe ingredient deconstruction, flavor profiling,
 * and scientific allergen mapping for culinary dishes.
 */

// Common culinary allergen sub-components based on RecipeDB gastronomical taxonomy
export const CULINARY_KNOWLEDGE_BASE = {
  // Gravy Bases & Thickeners
  "makhani": {
    typicalIngredients: ["tomato", "butter", "cream", "cashew paste", "kasuri methi", "garam masala"],
    commonAllergens: ["Dairy / Milk / Lactose", "Tree Nuts (Cashew)"],
    flavorProfile: { rich: 9, creamy: 9, sweet: 4, spicy: 5, tangy: 6 }
  },
  "shahi / korma": {
    typicalIngredients: ["curd/yogurt", "onion paste", "cashew paste", "almond paste", "melon seeds (magaz)", "cream", "saffron"],
    commonAllergens: ["Dairy / Milk / Lactose", "Tree Nuts (Cashew, Almond)"],
    flavorProfile: { rich: 10, creamy: 9, sweet: 6, spicy: 4, tangy: 2 }
  },
  "dal tadka": {
    typicalIngredients: ["yellow lentils (toor/moong)", "ghee/oil", "cumin", "garlic", "compounded asafoetida (hing)", "chili", "coriander"],
    commonAllergens: ["Gluten / Wheat (Compounded Hing contains maida)", "Dairy (if tempered in Ghee)"],
    flavorProfile: { savory: 8, spicy: 6, tangy: 4, light: 7 }
  },
  "dosa / idli": {
    typicalIngredients: ["fermented rice", "urad dal", "fenugreek seeds", "water", "salt"],
    commonAllergens: ["Usually Gluten-Free naturally, unless cooked on shared tawa or made as Rava/Sooji Dosa"],
    flavorProfile: { savory: 7, tangy: 6, light: 8 }
  },
  "rava dosa": {
    typicalIngredients: ["sooji / semolina (wheat)", "rice flour", "curd", "cumin", "black pepper", "ginger"],
    commonAllergens: ["Gluten / Wheat (Semolina/Rava)", "Dairy / Milk / Lactose (Curd)"],
    flavorProfile: { crispy: 9, savory: 7, light: 7 }
  },
  "coconut chutney": {
    typicalIngredients: ["fresh grated coconut", "roasted chana dal", "green chilies", "mustard seeds", "curry leaves", "oil"],
    commonAllergens: ["Mustard (tadka seeds)"],
    flavorProfile: { fresh: 8, spicy: 6, creamy: 5 }
  },
  "peanut / shengdana chutney": {
    typicalIngredients: ["roasted peanuts", "garlic", "red chili powder", "salt", "cumin"],
    commonAllergens: ["Peanuts"],
    flavorProfile: { savory: 8, nutty: 10, spicy: 7 }
  },
  "indo-chinese (manchurian / hakka)": {
    typicalIngredients: ["refined wheat flour (maida)", "cornstarch", "soy sauce", "vinegar", "chili sauce", "ajinomoto"],
    commonAllergens: ["Gluten / Wheat (Maida batter & Soy sauce)", "Soy (Soy sauce)"],
    flavorProfile: { umami: 9, tangy: 8, spicy: 7 }
  }
};

/**
 * Enriches dish details using Foodoscope API (if configured) or local computational gastronomy base
 */
export async function enrichWithFoodoscope(dishNames = []) {
  const apiKey = process.env.FOODOSCOPE_API_KEY;
  const enriched = {};

  for (const name of dishNames) {
    const normalized = name.toLowerCase().trim();
    
    // Check local computational gastronomy dictionary
    let matchedKnowledge = null;
    for (const [pattern, data] of Object.entries(CULINARY_KNOWLEDGE_BASE)) {
      if (normalized.includes(pattern) || pattern.split(" / ").some(p => normalized.includes(p))) {
        matchedKnowledge = data;
        break;
      }
    }

    // Optional query to Foodoscope RecipeDB REST API if key is present
    if (apiKey) {
      try {
        const response = await fetch(`https://api.foodoscope.com/recipe/search?q=${encodeURIComponent(name)}`, {
          headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json" }
        });
        if (response.ok) {
          const data = await response.json();
          enriched[name] = {
            source: "foodoscope_api",
            recipeDetails: data,
            gastronomyKnowledge: matchedKnowledge
          };
          continue;
        }
      } catch (err) {
        // Fallback gracefully to gastronomy knowledge
      }
    }

    enriched[name] = {
      source: "computational_gastronomy_rules",
      gastronomyKnowledge: matchedKnowledge
    };
  }

  return enriched;
}
