import type { Player } from "./types";

export interface ExtractedPlayer {
  name: string;
  doubles: number | null;
  section?: "confirmed" | "waitlisted";
  checkedIn?: boolean;
}

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `p${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Key used to spot the same player across overlapping screenshots. */
export function nameKey(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function cleanRating(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n < 1 || n > 8) return null;
  return Math.round(n * 1000) / 1000;
}

/**
 * Merge players read from several screenshots: drop duplicates, keep the first
 * rating seen (or a later one if the first was unrated), optionally drop the waitlist.
 */
export function mergeExtracted(
  lists: ExtractedPlayer[][],
  opts: { includeWaitlisted?: boolean; existing?: Player[] } = {},
): Player[] {
  const out: Player[] = opts.existing ? [...opts.existing] : [];
  const byKey = new Map<string, Player>();
  for (const p of out) byKey.set(nameKey(p.name), p);
  for (const list of lists) {
    for (const raw of list) {
      if (!raw || typeof raw.name !== "string") continue;
      if (raw.section === "waitlisted" && !opts.includeWaitlisted) continue;
      const name = cleanName(raw.name);
      const key = nameKey(name);
      if (!key) continue;
      const rating = cleanRating(raw.doubles);
      const found = byKey.get(key);
      if (found) {
        if (found.rating == null && rating != null) found.rating = rating;
        continue;
      }
      const p: Player = { id: newId(), name, rating, present: true, left: false };
      byKey.set(key, p);
      out.push(p);
    }
  }
  return out;
}

/** "Name, 3.21" / "Name 3.21" / "Name NR" / "Name" per line. */
export function parsePastedList(text: string): ExtractedPlayer[] {
  const res: ExtractedPlayer[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^(.*?)[\s,;:\t-]+(\d+(?:\.\d+)?|NR|nr|-)\s*$/);
    if (m && m[1].trim()) {
      res.push({ name: m[1].replace(/[,;:\t]+$/, "").trim(), doubles: cleanRating(m[2]) });
    } else {
      res.push({ name: t.replace(/[,;:\t]+$/, ""), doubles: null });
    }
  }
  return res;
}

export function median(values: number[]): number {
  if (!values.length) return 3.0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const m = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return Math.round(m * 1000) / 1000;
}

/** Group median of rated players — the default for unrated players. */
export function groupMedian(players: Player[]): number {
  return median(players.filter((p) => p.rating != null).map((p) => p.rating as number));
}

export function ratingMap(players: Player[]): Map<string, number> {
  const med = groupMedian(players);
  return new Map(players.map((p) => [p.id, p.rating ?? med]));
}
