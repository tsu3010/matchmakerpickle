import { ProviderError, type VisionProvider } from "./types.js";

/**
 * Google Gemini via the REST generateContent endpoint.
 * Env: GEMINI_API_KEY (required), GEMINI_MODEL (optional), GEMINI_BASE_URL (optional).
 */
export const gemini: VisionProvider = {
  name: "gemini",
  check(env) {
    if (!env.GEMINI_API_KEY) throw new ProviderError("GEMINI_API_KEY is not set on the server.", 500);
  },
  async run(prompt, images, env) {
    const model = env.GEMINI_MODEL || "gemini-3.8-flash";
    const base = (env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
    const res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...images.map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.data } })),
            ],
          },
        ],
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text.slice(0, 300);
      try {
        msg = JSON.parse(text)?.error?.message ?? msg;
      } catch {
        /* keep raw */
      }
      throw new ProviderError(`Gemini error ${res.status}: ${msg}`, res.status === 429 ? 429 : 502);
    }
    const json = JSON.parse(text);
    const parts: { text?: string }[] = json?.candidates?.[0]?.content?.parts ?? [];
    const out = parts.map((p) => p.text ?? "").join("");
    if (!out) throw new ProviderError("Gemini returned no text (the image may have been blocked or unreadable).");
    return out;
  },
};
