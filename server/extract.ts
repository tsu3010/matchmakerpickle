import { EXTRACT_PROMPT } from "./prompt.js";
import { getProvider } from "./providers/index.js";
import { ProviderError, type Env, type InputImage } from "./providers/types.js";

export interface ExtractedRow {
  name: string;
  doubles: number | null;
  section: "confirmed" | "waitlisted";
  checkedIn: boolean;
}

export interface ExtractResult {
  status: number;
  body: { players?: ExtractedRow[]; provider?: string; error?: string };
}

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 3_000_000; // after base64 decode, per image

/** Pull the JSON object out of a model reply (tolerates ```json fences and chatter). */
export function parseModelJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new ProviderError("Could not find JSON in the vision model's reply.");
  return JSON.parse(candidate.slice(start, end + 1));
}

export function sanitizeRows(raw: unknown): ExtractedRow[] {
  const list = (raw as { players?: unknown })?.players;
  if (!Array.isArray(list)) throw new ProviderError("Vision model reply had no players list.");
  const rows: ExtractedRow[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.replace(/\s+/g, " ").trim() : "";
    if (!name) continue;
    const d = typeof o.doubles === "string" ? parseFloat(o.doubles) : o.doubles;
    const doubles = typeof d === "number" && Number.isFinite(d) && d >= 1 && d <= 8 ? d : null;
    const section = String(o.section ?? "confirmed").toLowerCase().startsWith("wait") ? "waitlisted" : "confirmed";
    rows.push({ name: name.slice(0, 60), doubles, section, checkedIn: o.checked_in === true || o.checkedIn === true });
  }
  return rows;
}

function readImages(body: unknown): InputImage[] {
  const imgs = (body as { images?: unknown })?.images;
  if (!Array.isArray(imgs) || imgs.length === 0) throw new ProviderError("Send at least one screenshot.", 400);
  if (imgs.length > MAX_IMAGES) throw new ProviderError(`Send at most ${MAX_IMAGES} screenshots at a time.`, 400);
  return imgs.map((i) => {
    const o = i as Record<string, unknown>;
    const mimeType = typeof o.mimeType === "string" ? o.mimeType : "";
    const data = typeof o.data === "string" ? o.data.replace(/^data:[^,]+,/, "") : "";
    if (!/^image\/(png|jpe?g|webp|heic|heif)$/.test(mimeType) || !data) throw new ProviderError("Each screenshot must be a PNG, JPEG or WebP image.", 400);
    if (data.length * 0.75 > MAX_IMAGE_BYTES) throw new ProviderError("A screenshot is too large.", 413);
    return { mimeType, data };
  });
}

/** Shared by the Vercel function (api/extract.ts) and the local dev server (vite.config.mts). */
export async function handleExtract(body: unknown, passcodeHeader: string | undefined, env: Env): Promise<ExtractResult> {
  try {
    if (env.APP_PASSCODE && passcodeHeader !== env.APP_PASSCODE) {
      return { status: 401, body: { error: "Passcode required." } };
    }
    const images = readImages(body);
    const provider = getProvider(env);
    const text = await provider.run(EXTRACT_PROMPT, images, env);
    const players = sanitizeRows(parseModelJson(text));
    return { status: 200, body: { players, provider: provider.name } };
  } catch (e) {
    if (e instanceof ProviderError) return { status: e.status, body: { error: e.message } };
    if (e instanceof SyntaxError) return { status: 502, body: { error: "The vision model returned malformed JSON. Try again." } };
    return { status: 500, body: { error: e instanceof Error ? e.message : "Unexpected server error." } };
  }
}
