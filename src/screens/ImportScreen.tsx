import { useRef, useState } from "react";
import { prepareImage, type PreparedImage } from "../lib/images";
import { mergeExtracted, parsePastedList, type ExtractedPlayer } from "../lib/roster";
import { getPasscode, setPasscode } from "../lib/storage";
import type { Player } from "../lib/types";

interface Props {
  existing: Player[];
  onDone: (players: Player[]) => void;
  onSkip?: () => void;
  onHelp?: () => void;
}

const MAX = 6;

export function ImportScreen({ existing, onDone, onSkip, onHelp }: Props) {
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needPass, setNeedPass] = useState(false);
  const [pass, setPass] = useState(getPasscode());
  const [includeWait, setIncludeWait] = useState(false);
  const [paste, setPaste] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX - images.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) setError(`Up to ${MAX} screenshots at a time.`);
    try {
      const prepared = await Promise.all(list.map((f) => prepareImage(f)));
      setImages((cur) => [...cur, ...prepared.filter((p) => !cur.some((c) => c.id === p.id))]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that image.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function read() {
    setBusy(true);
    setError(null);
    try {
      if (pass) setPasscode(pass);
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(pass ? { "x-app-passcode": pass } : {}) },
        body: JSON.stringify({ images: images.map(({ mimeType, data }) => ({ mimeType, data })) }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setNeedPass(true);
        throw new Error(pass ? "Wrong passcode." : "This app needs a passcode to read screenshots.");
      }
      if (!res.ok) throw new Error(json.error || `Server error (${res.status}).`);
      const rows: ExtractedPlayer[] = (json.players ?? []).map((r: { name: string; doubles: number | null; section: "confirmed" | "waitlisted"; checkedIn: boolean }) => r);
      if (!rows.length) throw new Error("No players found. Make sure the screenshots show the Participants tab.");
      onDone(mergeExtracted([rows], { includeWaitlisted: includeWait, existing }));
    } catch (e) {
      setError(e instanceof Error ? (e.message === "Failed to fetch" ? "No connection to the server. Check your signal and try again." : e.message) : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function usePaste() {
    const rows = parsePastedList(paste);
    if (!rows.length) return setError("Paste one player per line, e.g. “Maya, 3.41”.");
    onDone(mergeExtracted([rows], { existing }));
  }

  return (
    <div className="screen">
      <h1 className="h1">{existing.length ? "Add more players" : "Import players"}</h1>
      <p className="muted">Upload screenshots of the Reclub Participants tab. Overlapping screenshots are fine — duplicates are removed.</p>
      {onHelp && !existing.length && (
        <button type="button" className="help-card" onClick={onHelp}>
          <span className="help-card-q" aria-hidden>
            ?
          </span>
          <span>
            <strong>New here?</strong> See why this app exists and how to run a session in 6 steps.
          </span>
          <span aria-hidden>›</span>
        </button>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      {images.length === 0 ? (
        <button type="button" className="dropzone" onClick={() => fileRef.current?.click()}>
          <span className="dropzone-icon" aria-hidden>
            ⬆
          </span>
          <strong>Add Reclub screenshots</strong>
          <span className="muted">Up to {MAX} at once</span>
        </button>
      ) : (
        <div className="thumbs">
          {images.map((img) => (
            <div className="thumb" key={img.id}>
              <img src={img.preview} alt="Screenshot" />
              <button type="button" className="thumb-x" aria-label="Remove screenshot" onClick={() => setImages((c) => c.filter((x) => x.id !== img.id))}>
                ✕
              </button>
            </div>
          ))}
          {images.length < MAX && (
            <button type="button" className="thumb thumb-add" onClick={() => fileRef.current?.click()} aria-label="Add another screenshot">
              +
            </button>
          )}
        </div>
      )}

      <label className="check">
        <input type="checkbox" checked={includeWait} onChange={(e) => setIncludeWait(e.target.checked)} />
        Include waitlisted players
      </label>

      {needPass && (
        <label className="field">
          <span className="field-label">Passcode</span>
          <input className="input" type="password" inputMode="numeric" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Ask the organiser" />
        </label>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button type="button" className="btn btn-primary btn-block" disabled={!images.length || busy} onClick={read}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden /> Reading screenshots…
          </>
        ) : (
          `Read players${images.length ? ` from ${images.length} screenshot${images.length > 1 ? "s" : ""}` : ""}`
        )}
      </button>

      <details className="paste">
        <summary>Or type / paste a list</summary>
        <textarea className="input" rows={7} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Maya Fernandez, 3.41\nDaniel, 3.05\nPriya, NR"} />
        <button type="button" className="btn btn-block" disabled={!paste.trim()} onClick={usePaste}>
          Use this list
        </button>
      </details>

      {onSkip && (
        <button type="button" className="btn btn-ghost btn-block" onClick={onSkip}>
          Back to player list
        </button>
      )}
    </div>
  );
}
