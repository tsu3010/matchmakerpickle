import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleExtract } from "../server/extract";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }
  const body = typeof req.body === "string" ? safeJson(req.body) : req.body;
  const pass = req.headers["x-app-passcode"];
  const result = await handleExtract(body, Array.isArray(pass) ? pass[0] : pass, process.env);
  res.status(result.status).json(result.body);
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
