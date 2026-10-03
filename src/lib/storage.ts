import type { Session } from "./types";
import { DEFAULT_SETTINGS } from "./types";

export type Phase = "import" | "review" | "setup" | "play";

export interface Saved {
  phase: Phase;
  session: Session;
}

const KEY = "matchmakerpickle-v1";
const PASS_KEY = "matchmakerpickle-passcode";
const GUIDE_KEY = "matchmakerpickle-guide-seen";

export function freshSession(): Session {
  return { version: 1, players: [], settings: { ...DEFAULT_SETTINGS }, rounds: [], locked: 0, roundStartedAt: null };
}

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Saved;
    if (v?.session?.version !== 1) return null;
    return v;
  } catch {
    return null;
  }
}

export function save(v: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* private mode / full storage: app still works for this page load */
  }
}

export function clearSaved() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function getPasscode(): string {
  try {
    return localStorage.getItem(PASS_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setPasscode(v: string) {
  try {
    localStorage.setItem(PASS_KEY, v);
  } catch {
    /* ignore */
  }
}

export function hasSeenGuide(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === "1";
  } catch {
    return true; // storage blocked: don't pop the guide on every load
  }
}

export function markGuideSeen() {
  try {
    localStorage.setItem(GUIDE_KEY, "1");
  } catch {
    /* ignore */
  }
}
