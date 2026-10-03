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
