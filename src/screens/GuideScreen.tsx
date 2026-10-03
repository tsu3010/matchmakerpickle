interface Props {
  onClose: () => void;
}

/** "Why & how" — reachable from the Import screen and Menu, shown once on first open. */
export function GuideScreen({ onClose }: Props) {
  return (
    <div className="guide" role="dialog" aria-modal="true" aria-label="How MatchMakerPickle works">
      <header className="guide-top">
        <span>How it works</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close guide">
          ✕
        </button>
      </header>

      <div className="guide-body">
        <section className="guide-hero">
          <img src="/icon.svg" alt="" width={56} height={56} />
          <span className="guide-brand">MatchMakerPickle</span>
          <h1>Fair, balanced doubles — without the clipboard.</h1>
          <p>
            Running a 20+ player session usually means re-shuffling names between every round, chasing who has sat out, and fixing it all again when someone turns up late.
            MatchMakerPickle does that for you.
          </p>
        </section>

        <h2 className="guide-h2">Why it was built</h2>

        <article className="why">
          <div className="why-icon" aria-hidden>
            ⚖
          </div>
          <div>
            <h3>Balanced games of equal strength</h3>
            <p>Teams are built so their combined DUPR is within 0.30 of each other, and the strongest players are never stacked together.</p>
            <div className="demo-court" aria-label="Example balanced court">
              <div className="court-no">1</div>
              <div className="teams">
                <div className="team">
                  <span className="team-names">Alex <span className="amp">&</span> Tom</span>
                  <span className="team-r">5.92</span>
                </div>
                <div className="team">
                  <span className="team-names">Chloe <span className="amp">&</span> Kai</span>
                  <span className="team-r">5.89</span>
                </div>
              </div>
              <div className="gap">Δ.03</div>
            </div>
            <p className="why-note">A 3.59 player and a 2.34 player vs two mid-2.9s — a close game for everyone.</p>
          </div>
        </article>

        <article className="why">
          <div className="why-icon" aria-hidden>
            ⟳
          </div>
          <div>
            <h3>Fair for everyone, every round</h3>
            <ul className="ticks">
              <li>Everyone plays the same number of games (±1)</li>
              <li>No one sits out more than 2 rounds in a row</li>
              <li>A new partner every game, and a mix of opponents</li>
            </ul>
          </div>
        </article>

        <article className="why">
          <div className="why-icon" aria-hidden>
            ⏱
          </div>
          <div>
            <h3>Late arrivals and early leavers handled</h3>
            <p>Tap “Arrived” or “Left”. Rounds already played stay exactly as they were; every round after is rebuilt in about a second, and latecomers get extra games to catch up.</p>
            <div className="timeline" aria-label="Rounds 1 to 4 locked, rounds 5 to 11 rebuilt after Sam arrives late">
              {Array.from({ length: 11 }, (_, i) => (
                <span key={i} className={i < 4 ? "tl tl-locked" : "tl tl-new"}>
                  {i + 1}
                </span>
              ))}
            </div>
            <div className="timeline-legend">
              <span>
                <i className="tl tl-locked" /> played — locked
              </span>
              <span className="tl-arrow">Sam arrives →</span>
              <span>
                <i className="tl tl-new" /> rebuilt with Sam
              </span>
            </div>
          </div>
        </article>

        <article className="why">
          <div className="why-icon" aria-hidden>
            ✋
          </div>
          <div>
            <h3>No manual match-making</h3>
            <div className="compare">
              <div className="compare-col compare-before">
                <strong>Before</strong>
                <span>Type names into a group chat or whiteboard</span>
                <span>Work out pairings between every round</span>
                <span>Recount who's played when someone joins</span>
              </div>
              <div className="compare-col compare-after">
                <strong>With MatchMakerPickle</strong>
                <span>Screenshot Reclub, upload</span>
                <span>Tap “Start round”</span>
                <span>Tap “Arrived” / “Left”</span>
              </div>
            </div>
          </div>
        </article>

        <h2 className="guide-h2">How to use it</h2>
        <ol className="how">
          <li>
            <strong>Screenshot Reclub.</strong> Open the meet's <em>Participants</em> tab and screenshot the whole list. Overlaps are fine.
          </li>
          <li>
            <strong>Import &amp; check.</strong> Upload the screenshots. Fix any name or rating, and untick anyone not here yet. Unrated players use the group median.
          </li>
          <li>
            <strong>Set up.</strong> Start time, courts, minutes per round and session length → <em>Build schedule</em>.
          </li>
          <li>
            <strong>Play.</strong> On <em>Live</em>, tap <em>Start round</em> when courts are ready. The timer runs and the next round is shown so players can get ready.
          </li>
          <li>
            <strong>Adjust on the fly.</strong> <em>＋ Arrived</em> and <em>− Left</em> rebuild the rest of the night. To swap two players, open <em>Rounds</em> and tap one, then the other.
          </li>
          <li>
            <strong>Check fairness.</strong> <em>Stats</em> shows games, sit-outs, partners and opponents per player, and flags anything that couldn't be met.
          </li>
        </ol>

        <div className="tips">
          <strong>Tips</strong>
          <span>Keep the tab open courtside — rebuilds and swaps work without signal; only importing needs it.</span>
          <span>No screenshots? Use “Or type / paste a list” on the Import screen.</span>
          <span>Start fresh each week from Menu → New session.</span>
        </div>

        <button type="button" className="btn btn-primary btn-block btn-xl" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
