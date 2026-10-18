import { useLayoutEffect, useRef, useState } from "react";
import type { Room } from "../../types/party";
import { FunnyBoard } from "./FunnyBoard";
import { useGameClock } from "./useGameClock";

type Props = { room: Room };

/**
 * Fit a TV-only game board to the available viewport without scrollbars.
 * CSS handles normal scaling; this safeguard handles long prompts, ten answers,
 * and shorter TV/browser windows. It never changes the phone layout.
 */
export function FunnyDisplay({ room }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const game = room.funny;
  const seconds = useGameClock(game?.deadline ?? null, room.serverNow, game?.pausedRemainingMs ?? null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content || !game) return;

    const fit = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (width <= 0 || height <= 0) return;
      // Transforms do not affect layout measurements, so the unscaled
      // scroll size remains available even after a shrink-to-fit.
      const rawWidth = content.scrollWidth;
      const rawHeight = content.scrollHeight;
      const next = Math.min(1, (width - 4) / Math.max(1, rawWidth), (height - 4) / Math.max(1, rawHeight));
      const safe = Math.max(0.05, next);
      setFitScale(previous => Math.abs(previous - safe) < 0.005 ? previous : safe);
    };

    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    observer.observe(content);
    fit();
    return () => observer.disconnect();
  }, [game?.stage, game?.round, game?.revealCount, game?.answers.length, game?.prompt]);

  if (!game) return null;
  // Guidance is outside the scaled board so it stays above the bottom invite bar
  // even when the prompt/answer grid needs to shrink to fit the TV.
  const phaseGuidance = {
    submission: "Send your answer from your phone.",
    reveal: "The answers are appearing…",
    review: "Five seconds to read everything. Voting is next.",
    voting: "Vote privately on your phone.",
    results: null,
    finished: null,
  }[game.stage];
  return (
    <div className={`tv-game-stage tv-game-stage--${game.stage}`}>
      <div className="tv-game-hud">
        <span className="tv-game-round">
          HOT TAKE · {game.stage === "finished" ? "FINAL STANDINGS" : `ROUND ${game.round} / ${game.totalRounds}`}
        </span>
        {seconds !== null && (
          <span className="tv-game-countdown" aria-label={game.paused ? "Timer paused" : "Time remaining"}>
            ◷ {seconds}s{game.paused ? " · Paused" : ""}
          </span>
        )}
      </div>
      <div className="tv-fit-viewport" ref={viewportRef}>
        <div className="tv-fit-content" ref={contentRef} style={{ transform: `translate(-50%, ${game.stage === "submission" ? "0" : "-50%"}) scale(${fitScale})` }}>
          <div className="funny-tv-game">
            <FunnyBoard game={game} players={room.players} serverNow={room.serverNow} isDisplay />
          </div>
        </div>
      </div>
      {phaseGuidance && <p className="tv-game-caption">{phaseGuidance}</p>}
    </div>
  );
}
