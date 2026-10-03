import { useEffect, useMemo, useState } from "react";
import { buildReport, swapInRound, totalRounds } from "../lib/scheduler";
import { cleanRating, newId, ratingMap } from "../lib/roster";
import type { PlayerId, Session } from "../lib/types";
import { RoundCard, Sheet, type RoundStatus } from "../components";

type Tab = "live" | "rounds" | "stats";

interface Props {
  session: Session;
  setSession: (s: Session) => void;
  rebuild: (s: Session, msg?: string) => void;
  toast: (m: string) => void;
  busy: boolean;
}

export function PlayScreen({ session, setSession, rebuild, toast, busy }: Props) {
  const [tab, setTab] = useState<Tab>("live");
  const [sheet, setSheet] = useState<"arrived" | "left" | null>(null);
  const ratings = useMemo(() => ratingMap(session.players), [session.players]);
  const names = useMemo(() => new Map(session.players.map((p) => [p.id, p.name])), [session.players]);
  const report = useMemo(() => buildReport(session), [session]);
  const total = Math.min(totalRounds(session.settings), session.rounds.length);

  const statusOf = (i: number): RoundStatus => (i < session.locked - 1 ? "played" : i === session.locked - 1 ? "now" : i === session.locked ? "next" : "upcoming");

  return (
    <div className="screen screen-play">
      {tab === "live" && (
        <LiveTab session={session} setSession={setSession} ratings={ratings} names={names} total={total} statusOf={statusOf} openSheet={setSheet} flags={report.flags.length} goStats={() => setTab("stats")} />
      )}
      {tab === "rounds" && <RoundsTab session={session} setSession={setSession} rebuild={rebuild} ratings={ratings} names={names} statusOf={statusOf} toast={toast} busy={busy} />}
      {tab === "stats" && <StatsTab session={session} report={report} ratings={ratings} names={names} />}

      <nav className="tabbar" aria-label="Sections">
        {(
          [
            ["live", "Live"],
            ["rounds", "Rounds"],
            ["stats", report.flags.length ? `Stats · ${report.flags.length}⚠` : "Stats"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} type="button" className={tab === k ? "on" : ""} aria-current={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>

      {sheet === "arrived" && (
        <ArrivedSheet
          session={session}
          onClose={() => setSheet(null)}
          onConfirm={(next, who) => {
            setSheet(null);
            rebuild(next, `${who} added — rounds ${next.locked + 1}–${total} rebuilt`);
          }}
        />
      )}
      {sheet === "left" && (
        <LeftSheet
          session={session}
          onClose={() => setSheet(null)}
          onConfirm={(next, who) => {
            setSheet(null);
            rebuild(next, `${who} removed — rounds ${next.locked + 1}–${total} rebuilt`);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function LiveTab(props: {
  session: Session;
  setSession: (s: Session) => void;
  ratings: Map<PlayerId, number>;
  names: Map<PlayerId, string>;
  total: number;
  statusOf: (i: number) => RoundStatus;
  openSheet: (s: "arrived" | "left") => void;
  flags: number;
  goStats: () => void;
}) {
  const { session, setSession, total } = props;
  const curIdx = session.locked - 1;
  const cur = curIdx >= 0 ? session.rounds[curIdx] : null;
  const next = session.rounds[session.locked] ?? null;
  const now = useNow(!!cur && session.roundStartedAt != null);
  const remaining = cur && session.roundStartedAt ? session.settings.roundMinutes * 60 - Math.floor((now - session.roundStartedAt) / 1000) : null;
  const done = session.locked >= total;

  const startNext = () => setSession({ ...session, locked: session.locked + 1, roundStartedAt: Date.now() });
  const undo = () => {
    if (!confirm(`Undo starting round ${session.locked}? It will become “up next” again.`)) return;
    setSession({ ...session, locked: session.locked - 1, roundStartedAt: null });
  };

  return (
    <>
      {cur ? (
        <>
          <div className={`timer${remaining != null && remaining <= 0 ? " timer-up" : remaining != null && remaining <= 60 ? " timer-warn" : ""}`}>
            <span>
              Round {curIdx + 1} of {total}
            </span>
            <strong>{remaining == null ? "—" : remaining <= 0 ? "Time!" : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}</strong>
          </div>
          <RoundCard round={cur} index={curIdx} total={total} settings={session.settings} ratings={props.ratings} names={props.names} status="now" big />
        </>
      ) : (
        <div className="ready">
          <h1 className="h1">Ready to play</h1>
          <p className="muted">
            {total} rounds · first one below. Tap <strong className="ink">Start round 1</strong> when the courts are ready.
          </p>
        </div>
      )}

      {!done && next && (
        <>
          <button type="button" className="btn btn-primary btn-block btn-xl" onClick={startNext}>
            Start round {session.locked + 1} ▶
          </button>
          <RoundCard round={next} index={session.locked} total={total} settings={session.settings} ratings={props.ratings} names={props.names} status="next" big={!cur} />
        </>
      )}
      {done && (
        <div className="live-done">
          <strong>Last round is on.</strong> Thanks for running the session! <button type="button" className="link" onClick={props.goStats}>See stats</button>
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn" onClick={() => props.openSheet("arrived")}>
          ＋ Arrived
        </button>
        <button type="button" className="btn" onClick={() => props.openSheet("left")}>
          − Left
        </button>
      </div>
      {props.flags > 0 && (
        <button type="button" className="flag-banner" onClick={props.goStats}>
          ⚠ {props.flags} rule{props.flags > 1 ? "s" : ""} not fully met — see Stats
        </button>
      )}
      {session.locked > 0 && (
        <button type="button" className="btn btn-ghost btn-block btn-small" onClick={undo}>
          Undo “Start round {session.locked}”
        </button>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function RoundsTab(props: {
  session: Session;
  setSession: (s: Session) => void;
  rebuild: (s: Session, msg?: string) => void;
  ratings: Map<PlayerId, number>;
  names: Map<PlayerId, string>;
  statusOf: (i: number) => RoundStatus;
  toast: (m: string) => void;
  busy: boolean;
}) {
  const { session } = props;
  const [sel, setSel] = useState<{ round: number; id: PlayerId } | null>(null);
  const [showPlayed, setShowPlayed] = useState(false);
  const firstEditable = Math.max(0, session.locked - 1); // current round can still be corrected

  const pick = (round: number, id: PlayerId) => {
    if (!sel || sel.round !== round) return setSel({ round, id });
    if (sel.id === id) return setSel(null);
    const rounds = [...session.rounds];
    rounds[round] = swapInRound(rounds[round], sel.id, id);
    props.setSession({ ...session, rounds });
    props.toast(`Swapped ${props.names.get(sel.id)} ↔ ${props.names.get(id)} in R${round + 1}`);
    setSel(null);
  };

  return (
    <>
      <div className="tab-head">
        <h1 className="h1">All rounds</h1>
        <p className="hint">To swap: tap a player, then another player in the same round (including someone sitting out).</p>
      </div>
      {session.locked > 1 && (
        <button type="button" className="btn btn-ghost btn-block btn-small" onClick={() => setShowPlayed((v) => !v)}>
          {showPlayed ? "Hide" : "Show"} {session.locked - 1} played round{session.locked > 2 ? "s" : ""}
        </button>
      )}
      {session.rounds.map((r, i) => {
        if (i < session.locked - 1 && !showPlayed) return null;
        const editable = i >= firstEditable;
        return (
          <RoundCard
            key={i}
            round={r}
            index={i}
            total={session.rounds.length}
            settings={session.settings}
            ratings={props.ratings}
            names={props.names}
            status={props.statusOf(i)}
            selectable={editable}
            selected={sel?.round === i ? sel.id : null}
            onPick={(id) => pick(i, id)}
          />
        );
      })}
      <button
        type="button"
        className="btn btn-block"
        disabled={props.busy}
        onClick={() => confirm(`Rebuild rounds ${session.locked + 1}–${session.rounds.length}? Manual swaps in those rounds will be replaced.`) && props.rebuild(session, "Remaining rounds rebuilt")}
      >
        ↻ Rebuild remaining rounds
      </button>
    </>
  );
}

/* ------------------------------------------------------------------ */

function StatsTab({ session, report, ratings, names }: { session: Session; report: ReturnType<typeof buildReport>; ratings: Map<PlayerId, number>; names: Map<PlayerId, string> }) {
  const rows = [...report.stats.values()].sort((a, b) => (ratings.get(b.id) ?? 0) - (ratings.get(a.id) ?? 0));
  const player = new Map(session.players.map((p) => [p.id, p]));
  return (
    <>
      <h1 className="h1">Stats</h1>
      {report.flags.length === 0 ? (
        <div className="ok-box">✓ All rules met: equal games (±1), no one out 3 in a row, every court within {session.settings.maxGap.toFixed(2)}, no repeat partners, no opponent faced 3+ times.</div>
      ) : (
        <ul className="flags">
          {report.flags.map((f, i) => (
            <li key={i}>⚠ {f}</li>
          ))}
        </ul>
      )}
      <p className="hint">Whole schedule, including rounds not played yet. G games · Out sit-outs · P distinct partners · O distinct opponents.</p>
      <table className="stats">
        <thead>
          <tr>
            <th>Player</th>
            <th>G</th>
            <th>Out</th>
            <th>P</th>
            <th>O</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const p = player.get(s.id);
            return (
              <tr key={s.id} className={p?.left ? "dim" : ""}>
                <td>
                  <span className="st-name">{names.get(s.id)}</span>
                  <span className="st-r">
                    {(ratings.get(s.id) ?? 0).toFixed(2)}
                    {p?.rating == null ? "*" : ""}
                    {p?.left ? " · left" : !p?.present ? " · not here" : ""}
                  </span>
                </td>
                <td>{s.games}</td>
                <td>{s.outs}</td>
                <td>{s.partners}</td>
                <td>{s.opponents}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hint">* unrated — uses group median.</p>
    </>
  );
}

/* ------------------------------------------------------------------ */

function ArrivedSheet({ session, onClose, onConfirm }: { session: Session; onClose: () => void; onConfirm: (s: Session, who: string) => void }) {
  const waiting = session.players.filter((p) => !p.present || p.left);
  const [picked, setPicked] = useState<Set<PlayerId>>(new Set());
  const [name, setName] = useState("");
  const [rating, setRating] = useState("");
  const toggle = (id: PlayerId) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const confirmIt = () => {
    let players = session.players.map((p) => (picked.has(p.id) ? { ...p, present: true, left: false } : p));
    const who = session.players.filter((p) => picked.has(p.id)).map((p) => p.name);
    if (name.trim()) {
      players = [...players, { id: newId(), name: name.trim(), rating: cleanRating(rating), present: true, left: false }];
      who.push(name.trim());
    }
    if (!who.length) return;
    onConfirm({ ...session, players }, who.join(", "));
  };
  return (
    <Sheet title="Who arrived?" onClose={onClose}>
      {waiting.length > 0 ? (
        <ul className="pick-list">
          {waiting.map((p) => (
            <li key={p.id}>
              <button type="button" className={`pick-row${picked.has(p.id) ? " on" : ""}`} onClick={() => toggle(p.id)}>
                <span className="box">{picked.has(p.id) ? "✓" : ""}</span>
                <span>{p.name}</span>
                <span className="muted">{p.rating?.toFixed(2) ?? "unrated"}{p.left ? " · returning" : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Everyone on the list is already here.</p>
      )}
      <p className="field-label">New player</p>
      <div className="row">
        <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input input-rating" inputMode="decimal" placeholder="DUPR" value={rating} onChange={(e) => setRating(e.target.value)} />
      </div>
      <p className="hint">They join from round {session.locked + 1} and get extra games to catch up.</p>
      <button type="button" className="btn btn-primary btn-block" disabled={!picked.size && !name.trim()} onClick={confirmIt}>
        Add & rebuild
      </button>
    </Sheet>
  );
}

function LeftSheet({ session, onClose, onConfirm }: { session: Session; onClose: () => void; onConfirm: (s: Session, who: string) => void }) {
  const here = session.players.filter((p) => p.present && !p.left);
  const [picked, setPicked] = useState<Set<PlayerId>>(new Set());
  const toggle = (id: PlayerId) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  return (
    <Sheet title="Who left?" onClose={onClose}>
      <ul className="pick-list">
        {here.map((p) => (
          <li key={p.id}>
            <button type="button" className={`pick-row${picked.has(p.id) ? " on" : ""}`} onClick={() => toggle(p.id)}>
              <span className="box">{picked.has(p.id) ? "✓" : ""}</span>
              <span>{p.name}</span>
              <span className="muted">{(p.rating ?? 0) ? p.rating!.toFixed(2) : "unrated"}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">They're removed from round {session.locked + 1} onward. If they're on court in the current round, use Rounds → swap.</p>
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!picked.size}
        onClick={() => onConfirm({ ...session, players: session.players.map((p) => (picked.has(p.id) ? { ...p, left: true } : p)) }, here.filter((p) => picked.has(p.id)).map((p) => p.name).join(", "))}
      >
        Remove & rebuild
      </button>
    </Sheet>
  );
}
