import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeMenu, digitizeMenuImage } from "./services/sarvamService.js";
import { SAMPLE_MENUS } from "./data/sampleMenus.js";

// Ensure .env is loaded even if run without --env-file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, ".env");
if (!process.env.SARVAM_API_KEY && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      process.env[key.trim()] = vals.join("=").trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (req, res) => {
  // CORS & Security Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // API Route: Sample Menus
  if (req.method === "GET" && url.pathname === "/api/sample-menus") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(SAMPLE_MENUS));
    return;
  }

  // API Route: Analyze Menu
  if (req.method === "POST" && url.pathname === "/api/analyze") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
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
        } = payload;

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
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No menu text could be retrieved or provided." }));
          return;
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

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(advisory));
      } catch (err) {
        console.error("Analysis Error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || "Failed to analyze menu." }));
      }
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 Not Found");
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🍽️  SwaadSafe (Sarvam AI Food Advisor) is live!`);
  console.log(`🌐  Local URL: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
