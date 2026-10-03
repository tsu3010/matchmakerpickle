import { useEffect, type ReactNode } from "react";
import type { PlayerId, Round, Settings } from "./lib/types";
import { gameGap, roundClock, teamRating } from "./lib/scheduler";

export type RoundStatus = "played" | "now" | "next" | "upcoming";

interface RoundCardProps {
  round: Round;
  index: number;
  total: number;
  settings: Settings;
  ratings: Map<PlayerId, number>;
  names: Map<PlayerId, string>;
  status: RoundStatus;
  big?: boolean;
  selectable?: boolean;
  selected?: PlayerId | null;
  onPick?: (id: PlayerId) => void;
  headerRight?: ReactNode;
}

export function RoundCard(p: RoundCardProps) {
  const label = { played: "Played", now: "Now playing", next: "Up next", upcoming: "" }[p.status];
  const Name = ({ id }: { id: PlayerId }) => {
    const text = p.names.get(id) ?? "?";
    if (!p.selectable) return <span className="pname">{text}</span>;
    return (
      <button type="button" className={`pname pick${p.selected === id ? " picked" : ""}`} onClick={() => p.onPick?.(id)}>
        {text}
      </button>
    );
  };
  return (
    <section className={`round round-${p.status}${p.big ? " round-big" : ""}`} aria-label={`Round ${p.index + 1}`}>
      <header className="round-head">
        <div>
          <span className="round-no">R{p.index + 1}</span>
          <span className="round-time">{roundClock(p.settings, p.index)}</span>
          {label && <span className={`tag tag-${p.status}`}>{label}</span>}
        </div>
        {p.headerRight}
      </header>
      {p.round.games.map((g, ci) => {
        const gap = gameGap(g, p.ratings);
        const over = gap > p.settings.maxGap + 1e-9;
        return (
          <div className="court" key={ci}>
            <div className="court-no" aria-label={`Court ${ci + 1}`}>
              {ci + 1}
            </div>
            <div className="teams">
              <div className="team">
                <span className="team-names">
                  <Name id={g.team1[0]} /> <span className="amp">&</span> <Name id={g.team1[1]} />
                </span>
                <span className="team-r">{teamRating(g.team1, p.ratings).toFixed(2)}</span>
              </div>
              <div className="team">
                <span className="team-names">
                  <Name id={g.team2[0]} /> <span className="amp">&</span> <Name id={g.team2[1]} />
                </span>
                <span className="team-r">{teamRating(g.team2, p.ratings).toFixed(2)}</span>
              </div>
            </div>
            <div className={`gap${over ? " gap-over" : ""}`} title="Rating gap between teams">
              Δ{gap.toFixed(2).replace(/^0/, "")}
            </div>
          </div>
        );
      })}
      {p.round.out.length > 0 && (
        <div className="out">
          <span className="out-label">Out</span>
          <span className="out-names">
            {p.round.out.map((id) => (
              <Name key={id} id={id} />
            ))}
          </span>
        </div>
      )}
    </section>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Stepper(props: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; format?: (v: number) => string }) {
  const step = props.step ?? 1;
  const clamp = (v: number) => Math.min(props.max, Math.max(props.min, Math.round(v * 100) / 100));
  return (
    <div className="field">
      <span className="field-label">{props.label}</span>
      <div className="stepper">
        <button type="button" onClick={() => props.onChange(clamp(props.value - step))} aria-label={`Decrease ${props.label}`}>
          −
        </button>
        <span className="stepper-v">
          {props.format ? props.format(props.value) : props.value}
          {props.unit && <small> {props.unit}</small>}
        </span>
        <button type="button" onClick={() => props.onChange(clamp(props.value + step))} aria-label={`Increase ${props.label}`}>
          +
        </button>
      </div>
    </div>
  );
}
