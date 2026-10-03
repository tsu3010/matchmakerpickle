import { useState } from "react";
import { cleanRating, groupMedian, newId } from "../lib/roster";
import type { Player } from "../lib/types";

interface Props {
  players: Player[];
  onChange: (players: Player[]) => void;
  onAddScreenshots: () => void;
  onContinue: () => void;
  continueLabel: string;
  /** After the schedule exists, removing marks the player as left so past rounds stay intact. */
  softDelete?: boolean;
}

export function ReviewScreen({ players, onChange, onAddScreenshots, onContinue, continueLabel, softDelete }: Props) {
  const [newName, setNewName] = useState("");
  const [newRating, setNewRating] = useState("");
  const med = groupMedian(players);
  const present = players.filter((p) => p.present && !p.left).length;
  const later = players.filter((p) => !p.present && !p.left).length;

  const update = (id: string, patch: Partial<Player>) => onChange(players.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (id: string) => (softDelete ? update(id, { left: true, present: false }) : onChange(players.filter((p) => p.id !== id)));
  const add = () => {
    if (!newName.trim()) return;
    onChange([...players, { id: newId(), name: newName.trim(), rating: cleanRating(newRating), present: true, left: false }]);
    setNewName("");
    setNewRating("");
  };
  const sortByRating = () => onChange([...players].sort((a, b) => (b.rating ?? med) - (a.rating ?? med)));

  return (
    <div className="screen">
      <h1 className="h1">Check players</h1>
      <p className="muted">
        <strong className="ink">{present} here</strong>
        {later > 0 && <> · {later} expected later</>} · unrated use median <strong className="ink">{med.toFixed(2)}</strong>
      </p>
      <p className="hint">Untick anyone not here yet — add them with “Arrived” when they show up.</p>

      <div className="list-tools">
        <button type="button" className="btn btn-small" onClick={sortByRating}>
          Sort by rating
        </button>
        <button type="button" className="btn btn-small" onClick={onAddScreenshots}>
          + Screenshots
        </button>
      </div>

      <ul className="roster">
        {players.map((p) => (
          <li key={p.id} className={`roster-row${!p.present || p.left ? " roster-off" : ""}`}>
            <button
              type="button"
              className={`here${p.present && !p.left ? " here-on" : ""}`}
              aria-pressed={p.present && !p.left}
              aria-label={`${p.name} is ${p.present ? "here" : "not here yet"}`}
              onClick={() => update(p.id, { present: !(p.present && !p.left), left: false })}
            >
              {p.present && !p.left ? "✓" : ""}
            </button>
            <input className="input input-name" value={p.name} aria-label="Name" onChange={(e) => update(p.id, { name: e.target.value })} />
            <input
              className={`input input-rating${p.rating == null ? " unrated" : ""}`}
              inputMode="decimal"
              aria-label={`${p.name} doubles DUPR`}
              placeholder={med.toFixed(2)}
              defaultValue={p.rating ?? ""}
              onBlur={(e) => update(p.id, { rating: cleanRating(e.target.value) })}
            />
            <button type="button" className="icon-btn" aria-label={`Remove ${p.name}`} onClick={() => remove(p.id)}>
              ✕
            </button>
          </li>
        ))}
        <li className="roster-row roster-new">
          <span className="here here-ghost">+</span>
          <input className="input input-name" placeholder="Add player" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <input className="input input-rating" inputMode="decimal" placeholder="DUPR" value={newRating} onChange={(e) => setNewRating(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button type="button" className="icon-btn add" aria-label="Add player" onClick={add} disabled={!newName.trim()}>
            ＋
          </button>
        </li>
      </ul>

      <div className="sticky-foot">
        <button type="button" className="btn btn-primary btn-block" disabled={present < 4} onClick={onContinue}>
          {present < 4 ? "Need at least 4 players here" : continueLabel}
        </button>
      </div>
    </div>
  );
}
