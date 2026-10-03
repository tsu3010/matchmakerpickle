import { ProviderError, type VisionProvider } from "./types.js";

/**
 * Any OpenAI-compatible chat-completions API with image input:
 * OpenAI, Groq, OpenRouter, Together, Cloudflare Workers AI (OpenAI endpoint), etc.
 * Env: OPENAI_API_KEY, OPENAI_MODEL (required), OPENAI_BASE_URL (default https://api.openai.com/v1).
 */
export const openaiCompatible: VisionProvider = {
  name: "openai",
  check(env) {
    if (!env.OPENAI_API_KEY) throw new ProviderError("OPENAI_API_KEY is not set on the server.", 500);
    if (!env.OPENAI_MODEL) throw new ProviderError("OPENAI_MODEL is not set on the server.", 500);
  },
  async run(prompt, images, env) {
    const base = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...images.map((img) => ({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.data}` } })),
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
      throw new ProviderError(`Vision API error ${res.status}: ${msg}`, res.status === 429 ? 429 : 502);
    }
    const out = JSON.parse(text)?.choices?.[0]?.message?.content;
    if (typeof out !== "string" || !out) throw new ProviderError("Vision API returned no text.");
    return out;
  },
};
