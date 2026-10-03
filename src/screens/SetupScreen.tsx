import { availablePlayers, courtsFor, formatClock, roundStartMinutes, totalRounds } from "../lib/scheduler";
import type { Player, Settings } from "../lib/types";
import { Stepper } from "../components";

interface Props {
  settings: Settings;
  players: Player[];
  locked: number;
  onChange: (s: Settings) => void;
  onBuild: () => void;
  onBack: () => void;
  busy: boolean;
}

export function SetupScreen({ settings, players, locked, onChange, onBuild, onBack, busy }: Props) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const rounds = totalRounds(settings);
  const here = availablePlayers(players).length;
  const courts = courtsFor(settings, here);
  const slots = courts * 4 * rounds;
  const lo = here ? Math.floor(slots / here) : 0;
  const hi = here ? Math.ceil(slots / here) : 0;
  const end = formatClock(roundStartMinutes(settings, rounds));
  const unused = settings.sessionMinutes - rounds * settings.roundMinutes;

  return (
    <div className="screen">
      <h1 className="h1">Session setup</h1>

      <label className="field">
        <span className="field-label">Start time</span>
        <input className="input" type="time" value={settings.startTime} onChange={(e) => set({ startTime: e.target.value || "19:00" })} />
      </label>
      <Stepper label="Courts" value={settings.courts} min={1} max={8} onChange={(v) => set({ courts: v })} />
      <Stepper label="Minutes per round" value={settings.roundMinutes} min={5} max={40} unit="min" onChange={(v) => set({ roundMinutes: v })} />
      <Stepper label="Session length" value={settings.sessionMinutes} min={30} max={300} step={15} unit="min" onChange={(v) => set({ sessionMinutes: v })} />
      <Stepper label="Max team rating gap" value={settings.maxGap} min={0.1} max={1} step={0.05} onChange={(v) => set({ maxGap: v })} format={(v) => v.toFixed(2)} />

      <div className="summary-box">
        <div className="big-stat">
          <strong>{rounds}</strong>
          <span>rounds</span>
        </div>
        <div className="big-stat">
          <strong>{lo === hi ? lo : `${lo}–${hi}`}</strong>
          <span>games each</span>
        </div>
        <div className="big-stat">
          <strong>{courts * 4}</strong>
          <span>on court</span>
        </div>
        <p className="summary-line">
          {here} players here · ends {end}
          {unused > 0 && ` · ${unused} min spare`}
          {courts < settings.courts && ` · only ${courts} court${courts === 1 ? "" : "s"} usable`}
        </p>
      </div>
      {locked > 0 && <p className="hint">Rounds already started stay as they are. Changes apply from round {locked + 1}.</p>}

      <div className="sticky-foot">
        <button type="button" className="btn btn-primary btn-block" disabled={busy || courts === 0} onClick={onBuild}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden /> Building…
            </>
          ) : locked > 0 ? (
            "Save & rebuild remaining rounds"
          ) : (
            "Build schedule"
          )}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
