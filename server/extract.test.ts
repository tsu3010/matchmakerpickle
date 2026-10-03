import { afterEach, describe, expect, it } from "vitest";
import { handleExtract, parseModelJson } from "./extract";

const IMG = { mimeType: "image/jpeg", data: "aGVsbG8=" };
const realFetch = globalThis.fetch;

function mockFetch(status: number, payload: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(payload), { status });
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("handleExtract", () => {
  it("calls Gemini and returns cleaned players", async () => {
    const reply = '```json\n{"players":[{"name":"Farah","doubles":3.239,"section":"confirmed","checked_in":true},{"name":"Wendy","doubles":"NR","section":"confirmed"},{"name":"Wait Person","doubles":3.1,"section":"waitlisted"}]}\n```';
    const calls = mockFetch(200, { candidates: [{ content: { parts: [{ text: reply }] } }] });
    const out = await handleExtract({ images: [IMG] }, undefined, { GEMINI_API_KEY: "k" });
    expect(out.status).toBe(200);
    expect(out.body.players).toEqual([
      { name: "Farah", doubles: 3.239, section: "confirmed", checkedIn: true },
      { name: "Wendy", doubles: null, section: "confirmed", checkedIn: false },
      { name: "Wait Person", doubles: 3.1, section: "waitlisted", checkedIn: false },
    ]);
    expect(calls[0].url).toContain("models/gemini-3.8-flash:generateContent");
    expect((calls[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
    const sent = JSON.parse(String(calls[0].init.body));
    expect(sent.contents[0].parts[1].inline_data.mime_type).toBe("image/jpeg");
  });

  it("switches provider with VISION_PROVIDER", async () => {
    const calls = mockFetch(200, { choices: [{ message: { content: '{"players":[{"name":"Ben","doubles":3.559}]}' } }] });
    const out = await handleExtract({ images: [IMG] }, undefined, {
      VISION_PROVIDER: "openai",
      OPENAI_API_KEY: "x",
      OPENAI_MODEL: "some-vision-model",
      OPENAI_BASE_URL: "https://api.groq.com/openai/v1",
    });
    expect(out.status).toBe(200);
    expect(out.body.provider).toBe("openai");
    expect(calls[0].url).toBe("https://api.groq.com/openai/v1/chat/completions");
  });

  it("enforces the optional passcode", async () => {
    const out = await handleExtract({ images: [IMG] }, "wrong", { APP_PASSCODE: "1234", GEMINI_API_KEY: "k" });
    expect(out.status).toBe(401);
  });

  it("explains a missing API key", async () => {
    const out = await handleExtract({ images: [IMG] }, undefined, {});
    expect(out.status).toBe(500);
    expect(out.body.error).toMatch(/GEMINI_API_KEY/);
  });

  it("passes provider errors through", async () => {
    mockFetch(429, { error: { message: "Quota exceeded" } });
    const out = await handleExtract({ images: [IMG] }, undefined, { GEMINI_API_KEY: "k" });
    expect(out.status).toBe(429);
    expect(out.body.error).toMatch(/Quota exceeded/);
  });

  it("rejects bad input", async () => {
    expect((await handleExtract({}, undefined, { GEMINI_API_KEY: "k" })).status).toBe(400);
    expect((await handleExtract({ images: [{ mimeType: "text/plain", data: "x" }] }, undefined, { GEMINI_API_KEY: "k" })).status).toBe(400);
  });

  it("parses JSON wrapped in chatter", () => {
    expect(parseModelJson('Sure! {"players":[]} hope that helps')).toEqual({ players: [] });
  });
});

