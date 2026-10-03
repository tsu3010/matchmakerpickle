export interface InputImage {
  /** e.g. "image/jpeg" */
  mimeType: string;
  /** base64 without the data: prefix */
  data: string;
}

export type Env = Record<string, string | undefined>;

/**
 * A vision provider takes the prompt + screenshots and returns the model's raw text.
 * To add a provider: implement this, then register it in ./index.ts.
 */
export interface VisionProvider {
  name: string;
  /** Throws a friendly error if required env vars are missing. */
  check(env: Env): void;
  run(prompt: string, images: InputImage[], env: Env): Promise<string>;
}

export class ProviderError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch() with retry + exponential backoff on transient upstream failures
 * (rate limits, overload, gateway errors). Callers keep their own status/body handling.
 */
export async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<{ status: number; text: string }> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    const text = await res.text();
    if (res.ok || !RETRYABLE_STATUSES.has(res.status) || attempt >= attempts - 1) return { status: res.status, text };
    await sleep(400 * 2 ** attempt + Math.random() * 200);
  }
}
