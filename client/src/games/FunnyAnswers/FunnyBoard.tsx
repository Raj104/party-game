import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PlayerIdentity } from "../../components/PlayerIdentity";
import { CharacterToken } from "../../components/CharacterToken";
import type { FunnyPublic, Player } from "../../types/party";
import { useGameClock } from "./useGameClock";

type TimerCommand = "pause" | "resume" | "skip" | "next";
type Props = { game: FunnyPublic; players: Player[]; serverNow: number; isDisplay?: boolean; showAnswers?: boolean;
  onTimerAction?: (command: TimerCommand) => void; controlsDisabled?: boolean;
  voteChoice?: string | null; ownAnswerId?: string | null; votedAnswerId?: string | null;
  canVote?: boolean; onSelectVote?: (answerId: string) => void;
  onConfirmVote?: () => void;
  voteDisabled?: boolean;
};

const captions: Record<FunnyPublic["stage"], string> = {
  submission: "WRITE SOMETHING STUPID", reveal: "THE BIG REVEAL", review: "TAKE A LOOK",
  voting: "PICK YOUR FAVORITE", results: "ROUND RESULTS", finished: "FINAL STANDINGS",
};

/**
 * Use the biggest readable answer font that actually fits its card.
 * Character-count thresholds alone cannot account for word wrapping,
 * different tablet widths, or extra vote/results metadata.
 */
function FittedAnswer({ text }: { text: string }) {
  const areaRef = useRef<HTMLParagraphElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const area = areaRef.current;
    const content = textRef.current;
    if (!area || !content) return;
    let active = true;

    function fitText() {
      if (!area || !content || !active) return;
      // Measure the *usable* portion of the answer box. The balanced top and
      // bottom inset keeps text centered while reserving the corner-number row.
      content.style.removeProperty("font-size");
      // Keep a generous upper limit even though the CSS uses a safe, smaller
      // fallback until measurement finishes.
      const inRevealDeck = Boolean(area.closest(".funny-reveal-card"));
      const maximum = inRevealDeck
        ? Math.min(68, Math.max(48, window.innerWidth * 0.053))
        : parseFloat(getComputedStyle(content).fontSize);
      const areaStyle = getComputedStyle(area);
      const availableWidth = area.clientWidth - parseFloat(areaStyle.paddingLeft) - parseFloat(areaStyle.paddingRight);
      const availableHeight = area.clientHeight - parseFloat(areaStyle.paddingTop) - parseFloat(areaStyle.paddingBottom);
      if (!maximum || availableWidth <= 0 || availableHeight <= 0) return;

      // The number is overlaid in the corner of reveal/voting cards. For
      // one-line answers we use the full height, but never let rendered glyph
      // lines actually intersect the number (including narrow/rotated cards).
      const corner = area.closest(".funny-reveal-card")?.querySelector<HTMLElement>(".funny-answer-number");
      const fits = () => {
        if (content.scrollHeight > availableHeight + 1 || content.scrollWidth > availableWidth + 1) return false;
        if (!corner) return true;
        const numberRect = corner.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(content);
        return Array.from(range.getClientRects()).every(rect =>
          rect.right <= numberRect.left || rect.left >= numberRect.right ||
          rect.bottom <= numberRect.top || rect.top >= numberRect.bottom);
      };
      // Try the generous size first. Never let the small fallback size cap
      // short answers (or prevent medium-length answers from growing).
      content.style.fontSize = `${maximum}px`;
      if (fits()) return;

      // Short responses begin large; scale longer ones smoothly until they fit.
      // Do not leave an oversized answer at the original size if the first
      // trial is too small for the available space.
      let lower = 8;
      let upper = maximum;
      content.style.fontSize = `${lower}px`;
      if (!fits()) return;
      for (let i = 0; i < 11; i++) {
        const middle = (lower + upper) / 2;
        content.style.fontSize = `${middle}px`;
        if (fits()) lower = middle;
        else upper = middle;
      }
      content.style.fontSize = `${Math.floor(lower * 10) / 10}px`;
    }

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fitText) : null;
    observer?.observe(area);
    window.addEventListener("resize", fitText);
    fitText();
    // Run again when a web font loads after the first layout.
    void document.fonts?.ready.then(() => { if (active) fitText(); });
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener("resize", fitText);
    };
  }, [text]);

  // A short answer can use the full centered space: it cannot approach the
  // small, top-left corner number. Long answers get a symmetric safe inset.
  const brief = text.trim().length <= 3;
  return <p className={`funny-answer-body${brief ? " funny-answer-body--brief" : ""}`} ref={areaRef}><span className="funny-answer-text" ref={textRef}>{text}</span></p>;
}

/**
 * One deck for every screen: newly revealed responses overlap like cards.
 * After the last answer, the same elements animate into a centered grid.
 * FLIP animation measures the cards before/after layout, so it also works
 * when a row wraps on tablet or phone widths.
 */
function RevealDeck({ answers, count, total, expanded, voting = false, voteChoice, ownAnswerId, votedAnswerId, canVote = false, onSelectVote, voteDisabled = false }: {
  answers: FunnyPublic["answers"];
  count: number;
  total: number;
  expanded: boolean;
  voting?: boolean;
  voteChoice?: string | null;
  ownAnswerId?: string | null;
  votedAnswerId?: string | null;
  canVote?: boolean;
  onSelectVote?: (answerId: string) => void;
  voteDisabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRects = useRef<Map<string, DOMRect>>(new Map());
  const wasExpanded = useRef(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll<HTMLElement>(".funny-reveal-card"));
    const prior = lastRects.current;
    const isNewlyExpanded = expanded && !wasExpanded.current;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (isNewlyExpanded && !reduceMotion) {
      const stackRect = Array.from(prior.values())[prior.size - 1];
      for (const card of cards) {
        const from = prior.get(card.dataset.answerId ?? "") ?? stackRect;
        if (!from) continue;
        const to = card.getBoundingClientRect();
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        const sx = from.width / Math.max(1, to.width);
        const sy = from.height / Math.max(1, to.height);
        card.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(-2deg)`, opacity: 0.94 },
            { transform: "translate(0, 0) scale(1, 1) rotate(0deg)", opacity: 1 },
          ],
          { duration: 680, easing: "cubic-bezier(.16, 1, .3, 1)" },
        );
      }
    }
    lastRects.current = new Map(cards.map(card => [card.dataset.answerId ?? "", card.getBoundingClientRect()]));
    wasExpanded.current = expanded;
  }, [answers.length, expanded]);

  return (
    <div className={`funny-reveal-deck${expanded ? " funny-reveal-deck--spread" : " funny-reveal-deck--stack"}`}>
      <div className={`funny-reveal-deck-cards${expanded ? " funny-answer-layout" : ""}`} ref={containerRef} aria-label={`${count} of ${total} answers revealed`}>
        {!expanded && count === 0 && total > 0 && (
          <div className="funny-reveal-wait-card" role="status">
            Hold on to your hats...
          </div>
        )}
        {answers.map((answer, index) => {
          const own = voting && answer.id === ownAnswerId;
          const chosen = voting && answer.id === voteChoice;
          const confirmed = voting && answer.id === votedAnswerId;
          const classes = `funny-answer-card funny-answer-tile funny-reveal-card${answer.text.length > 70 ? " funny-answer-tile--very-long" : answer.text.length > 52 ? " funny-answer-tile--long" : ""}${chosen || confirmed ? " selected" : ""}${confirmed ? " funny-reveal-card--confirmed" : ""}`;
          const style = {
            zIndex: expanded ? "auto" : index + 1,
            left: expanded ? undefined : "50%",
            top: expanded ? undefined : `calc(50% + ${(index % 4 - 1.5) * 3}px)`,
            rotate: expanded ? undefined : `${(index % 5 - 2) * 1.4}deg`,
          };
          const content = <><span className="funny-answer-number">#{index + 1}</span><FittedAnswer text={answer.text} />{own && <small>Your answer · can't vote</small>}</>;
          // Shared deck geometry is identical across review, voting and TV.
          return voting && canVote && !votedAnswerId ? (
            <button type="button" key={answer.id} data-answer-id={answer.id} className={classes}
              style={style} disabled={own || voteDisabled} aria-pressed={chosen}
              onClick={() => onSelectVote?.(answer.id)}>{content}</button>
          ) : (
            <article key={answer.id} data-answer-id={answer.id} className={classes} style={style}>
              {content}
            </article>
          );
        })}
      </div>
      {!voting && <p className="funny-reveal-count">{count} / {total} revealed</p>}
    </div>
  );
}

export function FunnyBoard({ game, players, serverNow, isDisplay = false, showAnswers = true, onTimerAction, controlsDisabled = false,
  voteChoice, ownAnswerId, votedAnswerId, canVote = false, onSelectVote, onConfirmVote, voteDisabled = false }: Props) {
  const seconds = useGameClock(game.deadline, serverNow, game.pausedRemainingMs);
  const [controlsOpen, setControlsOpen] = useState(false);
  const timerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!controlsOpen) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!timerMenuRef.current?.contains(event.target as Node)) setControlsOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setControlsOpen(false);
        timerMenuRef.current?.querySelector<HTMLButtonElement>(".funny-timer-menu-trigger")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [controlsOpen]);
  const [viewScores, setViewScores] = useState(false);
  useEffect(() => { setViewScores(false); }, [game.round]);
  useEffect(() => { setControlsOpen(false); }, [game.round, game.stage]);
  const playerById = (id: string) => players.find(player => player.id === id) ?? game.participants?.find(player => player.id === id);
  const results = game.stage === "results";
  const final = game.stage === "finished";
  const finalRoundResults = results && game.round === game.totalRounds;
  const orderedScores = [...game.scores].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const winnerScore = orderedScores[0]?.points;
  const winners = orderedScores.filter(p => p.points === winnerScore);
  const showScores = final || (results && viewScores);

  return (
    <section className={`funny-board funny-board--${game.stage}${isDisplay ? " funny-board-tv" : ""}`} aria-live="polite">
      <div className="funny-board-top">
        <span className="game-eyebrow">HOT TAKE · {final ? "THAT'S A WRAP" : `ROUND ${game.round} / ${game.totalRounds}`}</span>
        <div className="funny-clock-actions">
          {seconds !== null && <span className="funny-time" aria-label={game.paused ? "Timer paused" : "Time remaining"}>
            ◷ {seconds}s{game.paused ? " · Paused" : ""}
          </span>}
          {onTimerAction && (
            <div className="funny-timer-menu-wrap" ref={timerMenuRef}>
              <button type="button" className="funny-timer-menu-trigger" disabled={controlsDisabled}
                aria-label="Host timer controls" aria-expanded={controlsOpen}
                onClick={() => setControlsOpen(open => !open)}>
                <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M10 2h4l.6 2.4 2 1.2 2.4-.7 2 3.5-1.8 1.8v2.4l1.8 1.8-2 3.5-2.4-.7-2 1.2L14 21h-4l-.6-2.6-2-1.2-2.4.7-2-3.5 1.8-1.8v-2.4L3 8.4l2-3.5 2.4.7 2-1.2z" />
                </svg>
              </button>
              {controlsOpen && (
                <div className="funny-timer-menu" role="group" aria-label="Host timer controls">
                  <button type="button" disabled={controlsDisabled}
                    onClick={() => { onTimerAction(game.paused ? "resume" : "pause"); setControlsOpen(false); }}>
                    {game.paused ? "Resume" : "Pause"}
                  </button>
                  {game.stage === "reveal" && (
                    <button type="button" disabled={controlsDisabled} onClick={() => { onTimerAction("next"); setControlsOpen(false); }}>{game.revealCount >= game.submittedCount ? "Spread cards" : "Reveal next"}</button>
                  )}
                  <button type="button" disabled={controlsDisabled}
                    onClick={() => { onTimerAction("skip"); setControlsOpen(false); }}>
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="funny-board-core">
        {final ? <div className="final-heading"><span className="final-star" aria-hidden="true">✳</span><h2>Final standings.</h2><p>Bragging rights have been assigned.</p></div> :
          results ? <div className="results-heading"><p className="game-eyebrow">ROUND {game.round} COMPLETE</p><h2>{showScores ? "Overall standings" : "And the votes are in."}</h2></div> :
          <>
            <p className="funny-stage-label">{captions[game.stage]}{game.paused ? " · PAUSED" : ""}</p>
            <h2 className="funny-prompt">{game.prompt}</h2>
          </>
        }

        {game.stage === "submission" && (
          <div className="funny-status"><strong>{game.submittedCount} / {game.eligibleCount}</strong> answers submitted<span className="status-track"><i style={{ width: `${game.eligibleCount ? game.submittedCount / game.eligibleCount * 100 : 0}%` }} /></span></div>
        )}
        {game.stage === "review" && <p className="funny-status-text">Five seconds to read everything. Voting is next.</p>}
        {game.stage === "voting" && (isDisplay ? (
          <div className="funny-status funny-status--votes" role="status" aria-label={`${game.votedCount} of ${game.eligibleCount} votes in`}>
            <strong>{game.votedCount} / {game.eligibleCount}</strong> votes in
            <span className="status-track"><i style={{ width: `${game.eligibleCount ? game.votedCount / game.eligibleCount * 100 : 0}%` }} /></span>
          </div>
        ) : (
          <p className="funny-status-text funny-phase-hint">{game.votedCount} / {game.eligibleCount} votes in · One vote per player</p>
        ))}
        {(game.stage === "reveal" || game.stage === "review" || (game.stage === "voting" && showAnswers)) && (
          <RevealDeck
            answers={game.answers}
            count={game.stage === "reveal" ? game.revealCount : game.answers.length}
            total={game.submittedCount}
            expanded={game.stage !== "reveal"}
            voting={game.stage === "voting"}
            voteChoice={voteChoice}
            ownAnswerId={ownAnswerId}
            votedAnswerId={votedAnswerId}
            canVote={canVote}
            onSelectVote={onSelectVote}
            voteDisabled={voteDisabled}
          />
        )}
        {game.stage === "voting" && canVote && (
          <div className="funny-voting-actions">
            {votedAnswerId ? <p className="muted">Your vote is locked in. Waiting for everyone else…</p> : <>
              <button type="button" className="primary" disabled={controlsDisabled || !voteChoice} onClick={onConfirmVote}>Confirm Vote</button>
              <p className="muted">You cannot vote for your own answer. Confirmed votes cannot be changed.</p>
            </>}
          </div>
        )}
        {results && <p className="funny-results-auto-note">{finalRoundResults
          ? (game.paused ? "Final standings paused by host." : "Final standings appear automatically.")
          : (game.paused ? "Next round paused by host." : "Next round starts automatically.")}</p>}
        {results && <div className="results-toggle" role="group" aria-label="Results view">
          <button type="button" className={!viewScores ? "is-active" : ""} onClick={() => setViewScores(false)}>Round votes</button>
          <button type="button" className={viewScores ? "is-active" : ""} onClick={() => setViewScores(true)}>Overall scores</button>
        </div>}

        {showScores && (
          <div className={`funny-standings${final ? " funny-standings--final" : ""}`}>
            {orderedScores.map((entry) => (
              <div className={`funny-standing${entry.points === winnerScore ? " funny-standing--first" : ""}`} key={entry.id}>
                <span className="standing-position">{1 + orderedScores.filter(other => other.points > entry.points).length}</span>
                <PlayerIdentity name={entry.name} character={entry.character ?? playerById(entry.id)?.character} />
                <strong>{entry.points} <small>pts</small></strong>
              </div>
            ))}
            {final && winners.length > 0 && <p className="funny-winner">{winners.map(p => p.name).join(" & ")} {winners.length === 1 ? "wins!" : "tie for first!"}</p>}
          </div>
        )}

        {!showScores && results && (
          game.answers.length > 1 ? <div className="funny-answers-grid funny-answers-grid--results funny-answer-layout">
            {game.answers.map((answer, index) => {
              const author = answer.authorId ? playerById(answer.authorId) : undefined;
              return <article className={`funny-answer-card funny-answer-tile funny-answer-tile--results${answer.text.length > 70 ? " funny-answer-tile--very-long" : answer.text.length > 52 ? " funny-answer-tile--long" : ""}`} key={answer.id}>
                <div className="funny-answer-head"><span className="funny-answer-number">#{index + 1}</span><div className="funny-voter-tokens" aria-label={`${answer.votes ?? 0} votes`}>
                  {answer.voterIds?.map((id) => {
                    const voter = playerById(id);
                    return <span title={voter?.name ?? "Former player"} key={id}><CharacterToken character={voter?.character ?? "scribble"} /></span>;
                  })}
                </div></div>
                <FittedAnswer text={answer.text} />
                <div className="funny-answer-by"><PlayerIdentity name={answer.author ?? "Former player"} character={author?.character} compact /><strong>{answer.votes ?? 0} {(answer.votes ?? 0) === 1 ? "vote" : "votes"}</strong></div>
              </article>;
            })}
          </div> : <p className="funny-status-text">{game.answers.length === 0 ? "Nobody submitted an answer." : "Only one answer came in."} No points this round.</p>
        )}
      </div>
    </section>
  );
}
