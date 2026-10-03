import { gemini } from "./gemini.js";
import { openaiCompatible } from "./openai.js";
import { ProviderError, type Env, type VisionProvider } from "./types.js";

/** Register new providers here; pick one with the VISION_PROVIDER env var. */
const PROVIDERS: Record<string, VisionProvider> = {
  gemini,
  openai: openaiCompatible,
};

export function getProvider(env: Env): VisionProvider {
  const key = (env.VISION_PROVIDER || "gemini").toLowerCase();
  const p = PROVIDERS[key];
  if (!p) throw new ProviderError(`Unknown VISION_PROVIDER "${key}". Use one of: ${Object.keys(PROVIDERS).join(", ")}.`, 500);
  p.check(env);
  return p;
}
