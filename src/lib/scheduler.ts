import type { Game, Player, PlayerId, Round, Session, Settings } from "./types";
import { ratingMap } from "./roster";

/* ------------------------------------------------------------------ */
/* Basics                                                              */
/* ------------------------------------------------------------------ */

export function totalRounds(s: Settings): number {
  return Math.max(1, Math.floor(s.sessionMinutes / s.roundMinutes));
}

export function availablePlayers(players: Player[]): Player[] {
  return players.filter((p) => p.present && !p.left);
}

export function courtsFor(s: Settings, available: number): number {
  return Math.max(0, Math.min(s.courts, Math.floor(available / 4)));
}

export function pairKey(a: PlayerId, b: PlayerId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function teamRating(team: [PlayerId, PlayerId], r: Map<PlayerId, number>): number {
  return (r.get(team[0]) ?? 0) + (r.get(team[1]) ?? 0);
}

export function gameGap(g: Game, r: Map<PlayerId, number>): number {
  return Math.abs(teamRating(g.team1, r) - teamRating(g.team2, r));
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

interface History {
  games: Map<PlayerId, number>;
  partner: Map<string, number>;
  opp: Map<string, number>;
  lastPlayed: Map<PlayerId, number>;
  outStreak: Map<PlayerId, number>;
  rounds: number;
}

function emptyHistory(): History {
  return { games: new Map(), partner: new Map(), opp: new Map(), lastPlayed: new Map(), outStreak: new Map(), rounds: 0 };
}

function bump(m: Map<string, number>, k: string, by = 1) {
  m.set(k, (m.get(k) ?? 0) + by);
}

function applyRound(h: History, round: Round) {
  const idx = h.rounds;
  for (const g of round.games) {
    const [a, b] = g.team1;
    const [c, d] = g.team2;
    bump(h.partner, pairKey(a, b));
    bump(h.partner, pairKey(c, d));
    for (const x of g.team1) for (const y of g.team2) bump(h.opp, pairKey(x, y));
    for (const p of [a, b, c, d]) {
      bump(h.games, p);
      h.lastPlayed.set(p, idx);
      h.outStreak.set(p, 0);
    }
  }
  for (const p of round.out) bump(h.outStreak, p);
  h.rounds += 1;
}

function buildHistory(rounds: Round[]): History {
  const h = emptyHistory();
  for (const r of rounds) applyRound(h, r);
  return h;
}

/* ------------------------------------------------------------------ */
/* Who plays this round                                                */
/* ------------------------------------------------------------------ */

function chooseOnCourt(avail: PlayerId[], h: History, k: number, rng: () => number): PlayerId[] {
  const shuffled = shuffle(avail, rng);
  const key = (p: PlayerId) => {
    const streak = h.outStreak.get(p) ?? 0;
    return [
      streak >= 2 ? 0 : 1, // sat out 2 in a row: must play
      h.games.get(p) ?? 0, // fewest games first
      -streak, // longest current wait first
      h.lastPlayed.get(p) ?? -1, // longest since last game
    ];
  };
  const keyed = shuffled.map((p) => ({ p, k: key(p) }));
  keyed.sort((x, y) => {
    for (let i = 0; i < x.k.length; i++) if (x.k[i] !== y.k[i]) return x.k[i] - y.k[i];
    return 0;
  });
  return keyed.slice(0, k).map((x) => x.p);
}

/* ------------------------------------------------------------------ */
/* Court assignment                                                    */
/* ------------------------------------------------------------------ */

interface CostCtx {
  r: Map<PlayerId, number>;
  h: History;
  maxGap: number;
  top: Set<PlayerId>;
}

function gameCost(a: PlayerId, b: PlayerId, c: PlayerId, d: PlayerId, ctx: CostCtx): number {
  const { r, h, maxGap, top } = ctx;
  const diff = Math.abs((r.get(a)! + r.get(b)!) - (r.get(c)! + r.get(d)!));
  let cost = diff * 10;
  if (diff > maxGap + 1e-9) cost += 200 + (diff - maxGap) * 3000; // balance (priority 3)
  cost += ((h.partner.get(pairKey(a, b)) ?? 0) + (h.partner.get(pairKey(c, d)) ?? 0)) * 150; // repeat partner (4)
  for (const x of [a, b])
    for (const y of [c, d]) {
      const o = h.opp.get(pairKey(x, y)) ?? 0;
      cost += o * 6 + (o >= 2 ? 100 : 0); // same opponent a 3rd time
    }
  if (top.has(a) && top.has(b)) cost += 12; // strongest players stacked together
  if (top.has(c) && top.has(d)) cost += 12;
  return cost;
}

interface GroupBest {
  cost: number;
  game: Game;
}

function bestPairing(q: PlayerId[], ctx: CostCtx): GroupBest {
  const [w, x, y, z] = q;
  const options: [PlayerId, PlayerId, PlayerId, PlayerId][] = [
    [w, x, y, z],
    [w, y, x, z],
    [w, z, x, y],
  ];
  let best: GroupBest | null = null;
  for (const [a, b, c, d] of options) {
    const cost = gameCost(a, b, c, d, ctx);
    if (!best || cost < best.cost) best = { cost, game: { team1: [a, b], team2: [c, d] } };
  }
  return best!;
}

/** Exact best split into courts (used for up to 16 players on court). */
function assignExact(P: PlayerId[], ctx: CostCtx): Game[] {
  const n = P.length;
  const groupMemo = new Map<number, GroupBest>();
  const groupOf = (mask: number) => {
    let g = groupMemo.get(mask);
    if (!g) {
      const q: PlayerId[] = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) q.push(P[i]);
      g = bestPairing(q, ctx);
      groupMemo.set(mask, g);
    }
    return g;
  };
  const memo = new Map<number, { cost: number; groups: number[] }>();
  const solve = (mask: number): { cost: number; groups: number[] } => {
    if (mask === 0) return { cost: 0, groups: [] };
    const hit = memo.get(mask);
    if (hit) return hit;
    let i = 0;
    while (!(mask & (1 << i))) i++;
    const rest: number[] = [];
    for (let j = i + 1; j < n; j++) if (mask & (1 << j)) rest.push(j);
    let best = { cost: Infinity, groups: [] as number[] };
    for (let a = 0; a < rest.length; a++)
      for (let b = a + 1; b < rest.length; b++)
        for (let c = b + 1; c < rest.length; c++) {
          const g = (1 << i) | (1 << rest[a]) | (1 << rest[b]) | (1 << rest[c]);
          const sub = solve(mask & ~g);
          const cost = groupOf(g).cost + sub.cost;
          if (cost < best.cost) best = { cost, groups: [g, ...sub.groups] };
        }
    memo.set(mask, best);
    return best;
  };
  const res = solve((1 << n) - 1);
  return res.groups.map((g) => groupOf(g).game);
}

/** Local search for very large court counts (17+ players on court). */
function assignLocal(P: PlayerId[], ctx: CostCtx, rng: () => number): Game[] {
  const order = shuffle(P, rng);
  const groups: PlayerId[][] = [];
  for (let i = 0; i < order.length; i += 4) groups.push(order.slice(i, i + 4));
  const costs = groups.map((g) => bestPairing(g, ctx).cost);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    for (let g1 = 0; g1 < groups.length; g1++)
      for (let g2 = g1 + 1; g2 < groups.length; g2++)
        for (let i = 0; i < 4; i++)
          for (let j = 0; j < 4; j++) {
            const A = [...groups[g1]];
            const B = [...groups[g2]];
            [A[i], B[j]] = [B[j], A[i]];
            const ca = bestPairing(A, ctx).cost;
            const cb = bestPairing(B, ctx).cost;
            if (ca + cb < costs[g1] + costs[g2] - 1e-9) {
              groups[g1] = A;
              groups[g2] = B;
              costs[g1] = ca;
              costs[g2] = cb;
              improved = true;
            }
          }
  }
  return groups.map((g) => bestPairing(g, ctx).game);
}

/* ------------------------------------------------------------------ */
/* Schedule scoring                                                    */
/* ------------------------------------------------------------------ */

interface ScheduleScore {
  key: number[];
}

function scoreSchedule(rounds: Round[], from: number, focus: PlayerId[], r: Map<PlayerId, number>, maxGap: number): ScheduleScore {
  const h = emptyHistory();
  let streakViolations = 0;
  let gapViolations = 0;
  let sumGap = 0;
  rounds.forEach((round, idx) => {
    applyRound(h, round);
    if (idx < from) return;
    for (const p of round.out) if ((h.outStreak.get(p) ?? 0) > 2) streakViolations++;
    for (const g of round.games) {
      const gap = gameGap(g, r);
      sumGap += gap;
      if (gap > maxGap + 1e-9) gapViolations++;
    }
  });
  let partnerRepeats = 0;
  for (const v of h.partner.values()) partnerRepeats += Math.max(0, v - 1);
  let oppOver2 = 0;
  let oppTwice = 0;
  for (const v of h.opp.values()) {
    oppOver2 += Math.max(0, v - 2);
    if (v === 2) oppTwice++;
  }
  const counts = focus.map((p) => h.games.get(p) ?? 0);
  const spread = counts.length ? Math.max(...counts) - Math.min(...counts) : 0;
  return {
    // Lexicographic, in the organiser's priority order.
    key: [Math.max(0, spread - 1), streakViolations, gapViolations, partnerRepeats, oppOver2, oppTwice, sumGap],
  };
}

function better(a: ScheduleScore, b: ScheduleScore | null): boolean {
  if (!b) return true;
  for (let i = 0; i < a.key.length; i++) {
    if (Math.abs(a.key[i] - b.key[i]) > 1e-9) return a.key[i] < b.key[i];
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Public: (re)generate                                                */
/* ------------------------------------------------------------------ */

export interface GenerateOptions {
  timeBudgetMs?: number;
  maxRestarts?: number;
  seed?: number;
}

/**
 * Keep rounds [0, from) exactly as they are and regenerate rounds [from, total)
 * for everyone currently present and not left.
 */
export function generateFrom(session: Session, from: number, opts: GenerateOptions = {}): Round[] {
  const { settings, players } = session;
  const total = totalRounds(settings);
  const kept = session.rounds.slice(0, Math.min(from, session.rounds.length));
  const start = kept.length;
  if (start >= total) return kept;

  const r = ratingMap(players);
  const avail = availablePlayers(players).map((p) => p.id);
  const courts = courtsFor(settings, avail.length);
  if (courts === 0) return kept;
  const k = courts * 4;
  const top = new Set(
    [...avail].sort((a, b) => (r.get(b) ?? 0) - (r.get(a) ?? 0)).slice(0, courts * 2),
  );

  const budget = opts.timeBudgetMs ?? 700;
  const maxRestarts = opts.maxRestarts ?? 400;
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const t0 = Date.now();
  let best: { rounds: Round[]; score: ScheduleScore } | null = null;

  for (let attempt = 0; attempt < maxRestarts; attempt++) {
    const rng = mulberry32(seed + attempt * 7919);
    const h = buildHistory(kept);
    const ctx: CostCtx = { r, h, maxGap: settings.maxGap, top };
    const future: Round[] = [];
    for (let i = start; i < total; i++) {
      const onCourt = chooseOnCourt(avail, h, k, rng);
      const games = k <= 16 ? assignExact(shuffle(onCourt, rng), ctx) : assignLocal(onCourt, ctx, rng);
      const playing = new Set(onCourt);
      const round: Round = { games, out: avail.filter((p) => !playing.has(p)) };
      applyRound(h, round);
      future.push(round);
    }
    const all = [...kept, ...future];
    const score = scoreSchedule(all, start, avail, r, settings.maxGap);
    if (better(score, best?.score ?? null)) best = { rounds: all, score };
    if (attempt >= 5 && Date.now() - t0 > budget) break;
  }
  return best!.rounds;
}

/* ------------------------------------------------------------------ */
/* Manual swap                                                         */
/* ------------------------------------------------------------------ */

/** Swap two players' positions within one round (court slots and/or sitting out). */
export function swapInRound(round: Round, a: PlayerId, b: PlayerId): Round {
  if (a === b) return round;
  const sw = (p: PlayerId) => (p === a ? b : p === b ? a : p);
  return {
    games: round.games.map((g) => ({
      team1: [sw(g.team1[0]), sw(g.team1[1])],
      team2: [sw(g.team2[0]), sw(g.team2[1])],
    })),
    out: round.out.map(sw),
  };
}

/* ------------------------------------------------------------------ */
/* Stats & flags                                                       */
/* ------------------------------------------------------------------ */

export interface PlayerStats {
  id: PlayerId;
  games: number;
  outs: number;
  maxOutStreak: number;
  partners: number;
  opponents: number;
  repeatPartners: PlayerId[];
  facedTwicePlus: { id: PlayerId; times: number }[];
  oppMin: number | null;
  oppMax: number | null;
}

export interface Report {
  stats: Map<PlayerId, PlayerStats>;
  flags: string[];
  gapsOver: { round: number; court: number; gap: number }[];
}

export function buildReport(session: Session): Report {
  const { players, rounds, settings } = session;
  const r = ratingMap(players);
  const name = new Map(players.map((p) => [p.id, p.name]));
  const stats = new Map<PlayerId, PlayerStats>();
  const get = (id: PlayerId) => {
    let s = stats.get(id);
    if (!s) {
      s = { id, games: 0, outs: 0, maxOutStreak: 0, partners: 0, opponents: 0, repeatPartners: [], facedTwicePlus: [], oppMin: null, oppMax: null };
      stats.set(id, s);
    }
    return s;
  };
  for (const p of players) if (!p.left || rounds.some((rd) => rd.games.some((g) => [...g.team1, ...g.team2].includes(p.id)))) get(p.id);

  const partnerSets = new Map<PlayerId, Map<PlayerId, number>>();
  const oppSets = new Map<PlayerId, Map<PlayerId, number>>();
  const streak = new Map<PlayerId, number>();
  const add = (m: Map<PlayerId, Map<PlayerId, number>>, a: PlayerId, b: PlayerId) => {
    let inner = m.get(a);
    if (!inner) m.set(a, (inner = new Map()));
    inner.set(b, (inner.get(b) ?? 0) + 1);
  };
  const gapsOver: Report["gapsOver"] = [];

  rounds.forEach((round, ri) => {
    round.games.forEach((g, ci) => {
      const gap = gameGap(g, r);
      if (gap > settings.maxGap + 1e-9) gapsOver.push({ round: ri + 1, court: ci + 1, gap });
      const [a, b] = g.team1;
      const [c, d] = g.team2;
      add(partnerSets, a, b); add(partnerSets, b, a); add(partnerSets, c, d); add(partnerSets, d, c);
      for (const x of g.team1) for (const y of g.team2) { add(oppSets, x, y); add(oppSets, y, x); }
      for (const p of [a, b, c, d]) { get(p).games++; streak.set(p, 0); }
    });
    for (const p of round.out) {
      const s = get(p);
      s.outs++;
      const v = (streak.get(p) ?? 0) + 1;
      streak.set(p, v);
      s.maxOutStreak = Math.max(s.maxOutStreak, v);
    }
  });

  for (const s of stats.values()) {
    const ps = partnerSets.get(s.id) ?? new Map();
    const os = oppSets.get(s.id) ?? new Map();
    s.partners = ps.size;
    s.opponents = os.size;
    s.repeatPartners = [...ps.entries()].filter(([, n]) => n > 1).map(([id]) => id);
    s.facedTwicePlus = [...os.entries()].filter(([, n]) => n > 1).map(([id, times]) => ({ id, times }));
    const oppRatings = [...os.keys()].map((id) => r.get(id) ?? 0);
    s.oppMin = oppRatings.length ? Math.min(...oppRatings) : null;
    s.oppMax = oppRatings.length ? Math.max(...oppRatings) : null;
  }

  const flags: string[] = [];
  const active = players.filter((p) => !p.left && stats.has(p.id));
  const fullTime = active.filter((p) => p.present);
  if (fullTime.length) {
    const counts = fullTime.map((p) => stats.get(p.id)!.games);
    const lo = Math.min(...counts);
    const hi = Math.max(...counts);
    if (hi - lo > 1) {
      const low = fullTime.filter((p) => stats.get(p.id)!.games === lo).map((p) => name.get(p.id));
      flags.push(`Games range ${lo}–${hi} (more than ±1). Lowest: ${low.join(", ")}.`);
    }
  }
  for (const s of stats.values()) {
    if (s.maxOutStreak > 2) flags.push(`${name.get(s.id)} sits out ${s.maxOutStreak} rounds in a row.`);
  }
  const seenPairs = new Set<string>();
  for (const s of stats.values())
    for (const pid of s.repeatPartners) {
      const k = pairKey(s.id, pid);
      if (seenPairs.has(k)) continue;
      seenPairs.add(k);
      flags.push(`Repeat partners: ${name.get(s.id)} + ${name.get(pid)}.`);
    }
  const seenOpp = new Set<string>();
  for (const s of stats.values())
    for (const o of s.facedTwicePlus)
      if (o.times > 2) {
        const k = pairKey(s.id, o.id);
        if (seenOpp.has(k)) continue;
        seenOpp.add(k);
        flags.push(`${name.get(s.id)} faces ${name.get(o.id)} ${o.times} times.`);
      }
  for (const g of gapsOver) flags.push(`R${g.round} Court ${g.court}: gap ${g.gap.toFixed(2)} (limit ${settings.maxGap.toFixed(2)}).`);
  const avail = availablePlayers(players).length;
  if (avail < 4) flags.push("Fewer than 4 players available — no games can be scheduled.");
  else if (courtsFor(settings, avail) < settings.courts)
    flags.push(`Only ${avail} players available — using ${courtsFor(settings, avail)} of ${settings.courts} courts.`);
  return { stats, flags, gapsOver };
}

/* ------------------------------------------------------------------ */
/* Clock                                                               */
/* ------------------------------------------------------------------ */

export function roundStartMinutes(s: Settings, i: number): number {
  const [h, m] = s.startTime.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0) + i * s.roundMinutes;
}

export function formatClock(totalMinutes: number): string {
  const mins = ((totalMinutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")}`;
}

export function roundClock(s: Settings, i: number): string {
  return formatClock(roundStartMinutes(s, i));
}
