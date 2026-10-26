import { analyzeMenu, digitizeMenuImage } from "../services/sarvamService.js";

function sendJson(res, statusCode, data) {
  if (typeof res.status === "function") {
    const s = res.status(statusCode);
    if (s && typeof s.json === "function") return s.json(data);
  }
  if (typeof res.json === "function") return res.json(data);
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  return res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    if (typeof res.status === "function") return res.status(204).end();
    res.writeHead(204);
    return res.end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    let payload = req.body;

    // Parse payload if passed as string or raw stream
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        payload = {};
      }
    } else if (!payload && typeof req.on === "function") {
      payload = await new Promise((resolve) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({});
          }
        });
      });
    }

    let {
      menuText,
      imageBase64,
      allergens,
      dietaryRestrictions,
      tastePreferences,
      preferredLanguage,
      calorieGoal,
      mealType,
      favoriteDishes,
      dietaryGoals
    } = payload || {};

    // If an image was submitted, run Sarvam Vision / Document AI
    if (imageBase64 && !menuText) {
      const match = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const buffer = Buffer.from(match[2], "base64");
        menuText = await digitizeMenuImage(buffer, mimeType);
      }
    }

    if (!menuText || !menuText.trim()) {
      return sendJson(res, 400, { error: "No menu text could be retrieved or provided." });
    }

    const advisory = await analyzeMenu({
      menuText,
      allergens: allergens || [],
      dietaryRestrictions: dietaryRestrictions || [],
      tastePreferences: tastePreferences || [],
      preferredLanguage: preferredLanguage || "English",
      calorieGoal: Number(calorieGoal) || 650,
      mealType: mealType || "Lunch",
      favoriteDishes: favoriteDishes || "",
      dietaryGoals: dietaryGoals || []
    });

    return sendJson(res, 200, advisory);
  } catch (err) {
    console.error("Vercel Function Error:", err);
    return sendJson(res, 500, { error: err.message || "Failed to analyze menu." });
  }
}
