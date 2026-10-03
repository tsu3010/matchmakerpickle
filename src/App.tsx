import { useCallback, useEffect, useRef, useState } from "react";
import { generateFrom } from "./lib/scheduler";
import { clearSaved, freshSession, hasSeenGuide, loadSaved, markGuideSeen, save, type Phase } from "./lib/storage";
import type { Session } from "./lib/types";
import { Sheet } from "./components";
import { ImportScreen } from "./screens/ImportScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { PlayScreen } from "./screens/PlayScreen";
import { GuideScreen } from "./screens/GuideScreen";

const STEPS: { key: Phase; label: string }[] = [
  { key: "import", label: "Import" },
  { key: "review", label: "Players" },
  { key: "setup", label: "Setup" },
  { key: "play", label: "Play" },
];

export default function App() {
  const initial = useRef(loadSaved());
  const [phase, setPhase] = useState<Phase>(initial.current?.phase ?? "import");
  const [session, setSession] = useState<Session>(initial.current?.session ?? freshSession());
  const [busy, setBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  // Show the guide automatically the first time someone opens the app.
  const [guide, setGuide] = useState(() => !initial.current && !hasSeenGuide());
  const toastTimer = useRef<number | undefined>(undefined);
  const started = session.rounds.length > 0;

  useEffect(() => save({ phase, session }), [phase, session]);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3500);
  }, []);

  /** Regenerate every round that hasn't started yet. Deferred a tick so the spinner paints. */
  const rebuild = useCallback(
    (s: Session, msg?: string, then?: () => void) => {
      setBusy(true);
      window.setTimeout(() => {
        const rounds = generateFrom(s, s.locked);
        setSession({ ...s, rounds });
        setBusy(false);
        if (msg) toast(msg);
        then?.();
      }, 30);
    },
    [toast],
  );

  const closeGuide = () => {
    markGuideSeen();
    setGuide(false);
  };

  const newSession = () => {
    if (!confirm("Start a new session? The current schedule will be cleared.")) return;
    clearSaved();
    setSession(freshSession());
    setPhase("import");
    setMenu(false);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/icon.svg" alt="" width={28} height={28} />
          <span>MatchMakerPickle</span>
        </div>
        <div className="top-actions">
          <button type="button" className="icon-btn menu-btn help-btn" aria-label="How it works" onClick={() => setGuide(true)}>
            ?
          </button>
          {(started || session.players.length > 0) && (
            <button type="button" className="icon-btn menu-btn" aria-label="Menu" onClick={() => setMenu(true)}>
              ☰
            </button>
          )}
        </div>
      </header>

      {phase !== "play" && (
        <ol className="steps" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className={s.key === phase ? "step-on" : STEPS.findIndex((x) => x.key === phase) > i ? "step-done" : ""}>
              {s.label}
            </li>
          ))}
        </ol>
      )}

      <main>
        {phase === "import" && (
          <ImportScreen
            existing={session.players}
            onDone={(players) => {
              setSession({ ...session, players });
              setPhase("review");
              toast(`${players.length} players in the list`);
            }}
            onSkip={session.players.length ? () => setPhase("review") : undefined}
            onHelp={() => setGuide(true)}
          />
        )}
        {phase === "review" && (
          <ReviewScreen
            players={session.players}
            onChange={(players) => setSession({ ...session, players })}
            onAddScreenshots={() => setPhase("import")}
            continueLabel={started ? "Save & rebuild remaining rounds" : "Continue"}
            softDelete={started}
            onContinue={() => (started ? rebuild(session, "Remaining rounds rebuilt", () => setPhase("play")) : setPhase("setup"))}
          />
        )}
        {phase === "setup" && (
          <SetupScreen
            settings={session.settings}
            players={session.players}
            locked={session.locked}
            busy={busy}
            onChange={(settings) => setSession({ ...session, settings })}
            onBack={() => setPhase(started ? "play" : "review")}
            onBuild={() => rebuild(session, started ? "Remaining rounds rebuilt" : "Schedule ready", () => setPhase("play"))}
          />
        )}
        {phase === "play" && <PlayScreen session={session} setSession={setSession} rebuild={(s, m) => rebuild(s, m)} toast={toast} busy={busy} />}
      </main>

      {busy && (
        <div className="busy" role="status">
          <span className="spinner" aria-hidden /> Building schedule…
        </div>
      )}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}

      {guide && <GuideScreen onClose={closeGuide} />}

      {menu && (
        <Sheet title="Menu" onClose={() => setMenu(false)}>
          <div className="menu">
            {started && (
              <button type="button" className="btn btn-block" onClick={() => (setPhase("play"), setMenu(false))}>
                Schedule
              </button>
            )}
            <button type="button" className="btn btn-block" onClick={() => (setPhase("review"), setMenu(false))}>
              Edit players & ratings
            </button>
            <button type="button" className="btn btn-block" onClick={() => (setPhase("setup"), setMenu(false))}>
              Edit session setup
            </button>
            <button type="button" className="btn btn-block" onClick={() => (setGuide(true), setMenu(false))}>
              How it works
            </button>
            <button type="button" className="btn btn-block btn-danger" onClick={newSession}>
              New session
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
