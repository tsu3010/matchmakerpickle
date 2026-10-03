import { describe, expect, it } from "vitest";
import { buildReport, generateFrom, roundClock, swapInRound, totalRounds } from "./scheduler";
import { mergeExtracted, parsePastedList } from "./roster";
import { DEFAULT_SETTINGS, type Session } from "./types";

// A typical session (illustrative names): 22 present + 2 late (Sam Rivera, Wendy).
const LIST = `Alex Tan, 3.585
Ben, 3.559
Chloe Lim, 3.466
Dev, 3.289
Ethan Wong, 3.244
Farah, 3.239
Grace Ho, 3.133
harrykoh, 3.077
Ivy, 3.024
Jay, 3.023
Kai Morgan, 2.946
Leah, 2.906
Marcus Yeo, 2.827
nina park, 2.668
Omar S, 2.534
Priya, 2.502
Quinn, 2.497
Raj, 2.487
Sofia M, 2.445
Tom Reid, 2.339
Uma K., 2.24
Victor, NR
Sam Rivera, 3.68
Wendy, NR`;

function session(): Session {
  const players = mergeExtracted([parsePastedList(LIST)]);
  for (const p of players) if (p.name === "Sam Rivera" || p.name === "Wendy") p.present = false;
  return { version: 1, players, settings: { ...DEFAULT_SETTINGS }, rounds: [], locked: 0, roundStartedAt: null };
}

describe("scheduler — 22-player session", () => {
  it("builds 11 rounds where everyone plays 6 and every rule holds", () => {
    const s = session();
    expect(totalRounds(s.settings)).toBe(11);
    s.rounds = generateFrom(s, 0, { seed: 1, timeBudgetMs: 1500 });
    expect(s.rounds).toHaveLength(11);
    for (const r of s.rounds) {
      expect(r.games).toHaveLength(3);
      expect(r.out).toHaveLength(10);
    }
    const rep = buildReport(s);
    const present = s.players.filter((p) => p.present);
    for (const p of present) {
      const st = rep.stats.get(p.id)!;
      expect(st.games).toBe(6);
      expect(st.maxOutStreak).toBeLessThanOrEqual(2);
      expect(st.partners).toBe(6); // no repeat partners
      for (const o of st.facedTwicePlus) expect(o.times).toBeLessThanOrEqual(2);
    }
    expect(rep.gapsOver).toHaveLength(0);
    expect(rep.flags).toEqual([]);
  });

  it("keeps played rounds and catches up late arrivals", () => {
    const s = session();
    s.rounds = generateFrom(s, 0, { seed: 2 });
    s.locked = 4;
    const played = JSON.stringify(s.rounds.slice(0, 4));
    for (const p of s.players) if (p.name === "Sam Rivera" || p.name === "Wendy") p.present = true;
    s.rounds = generateFrom(s, s.locked, { seed: 3 });
    expect(JSON.stringify(s.rounds.slice(0, 4))).toBe(played);
    const rep = buildReport(s);
    const sam = s.players.find((p) => p.name === "Sam Rivera")!;
    const wendy = s.players.find((p) => p.name === "Wendy")!;
    // 132 slots over 24 players = 5.5 each: latecomers catch up to everyone else (±1).
    expect(rep.stats.get(sam.id)!.games).toBeGreaterThanOrEqual(5);
    expect(rep.stats.get(wendy.id)!.games).toBeGreaterThanOrEqual(5);
    const counts = s.players.map((p) => rep.stats.get(p.id)!.games);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    for (const p of s.players) {
      const st = rep.stats.get(p.id)!;
      expect(st.maxOutStreak).toBeLessThanOrEqual(2);
      expect(st.repeatPartners).toHaveLength(0);
    }
  });

  it("drops a player who leaves from future rounds only", () => {
    const s = session();
    s.rounds = generateFrom(s, 0, { seed: 4 });
    s.locked = 6;
    const dev = s.players.find((p) => p.name === "Dev")!;
    dev.left = true;
    s.rounds = generateFrom(s, 6, { seed: 5 });
    for (let i = 6; i < s.rounds.length; i++) {
      const ids = [...s.rounds[i].out, ...s.rounds[i].games.flatMap((g) => [...g.team1, ...g.team2])];
      expect(ids).not.toContain(dev.id);
    }
  });

  it("drops to fewer courts when not enough players", () => {
    const s = session();
    s.players.forEach((p, i) => (p.present = i < 9));
    s.rounds = generateFrom(s, 0, { seed: 6 });
    expect(s.rounds[0].games).toHaveLength(2);
    expect(s.rounds[0].out).toHaveLength(1);
  });

  it("swaps two players within a round", () => {
    const s = session();
    s.rounds = generateFrom(s, 0, { seed: 7 });
    const r = s.rounds[0];
    const a = r.games[0].team1[0];
    const b = r.out[0];
    const swapped = swapInRound(r, a, b);
    expect(swapped.games[0].team1[0]).toBe(b);
    expect(swapped.out[0]).toBe(a);
  });

  it("formats round clock times", () => {
    expect(roundClock(DEFAULT_SETTINGS, 0)).toBe("7:00");
    expect(roundClock(DEFAULT_SETTINGS, 3)).toBe("7:39");
    expect(roundClock(DEFAULT_SETTINGS, 10)).toBe("9:10");
  });
});

describe("roster import", () => {
  it("dedupes overlapping screenshots and drops the waitlist", () => {
    const merged = mergeExtracted([
      [
        { name: "Chloe Lim", doubles: 3.466, section: "confirmed" },
        { name: "Dev", doubles: 3.289, section: "confirmed" },
        { name: "Wendy", doubles: null, section: "confirmed" },
      ],
      [
        { name: "chloe  lim", doubles: 3.466, section: "confirmed" },
        { name: "Wendy", doubles: 2.9, section: "confirmed" },
        { name: "Wait Person", doubles: 3.0, section: "waitlisted" },
      ],
    ]);
    expect(merged.map((p) => p.name)).toEqual(["Chloe Lim", "Dev", "Wendy"]);
    expect(merged[2].rating).toBe(2.9);
  });

  it("parses pasted lists", () => {
    const l = parsePastedList("Uma K., 2.24\nVictor NR\nBen 3.559\nJust A Name");
    expect(l).toEqual([
      { name: "Uma K.", doubles: 2.24 },
      { name: "Victor", doubles: null },
      { name: "Ben", doubles: 3.559 },
      { name: "Just A Name", doubles: null },
    ]);
  });
});
