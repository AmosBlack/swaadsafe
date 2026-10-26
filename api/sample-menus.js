import { SAMPLE_MENUS } from "../data/sampleMenus.js";

function sendJson(res, statusCode, data) {
  if (typeof res.status === "function") {
    const s = res.status(statusCode);
    if (s && typeof s.json === "function") return s.json(data);
  }
  if (typeof res.json === "function") return res.json(data);
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  return res.end(JSON.stringify(data));
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    if (typeof res.status === "function") return res.status(204).end();
    res.writeHead(204);
    return res.end();
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  // Cache sample menus for fast delivery
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
  return sendJson(res, 200, SAMPLE_MENUS);
}
