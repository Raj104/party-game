import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GAMES, findGame, gameAccent } from "../data/games";
import type { CSSProperties } from "react";
import type { GameId, Room } from "../types/party";
import { GameCard } from "./GameCard";
import { FunnySetup } from "../games/FunnyAnswers/FunnySetup";

type Props = {
  room: Room;
  isHost: boolean;
  connected: boolean;
  busy: boolean;
  onAction: (event: string, gameId?: GameId) => void;
  onSetRounds: (rounds: number) => void;
};

/** The room owns the host's pick. Every player's browsing view stays local. */
export function GamePhasePanel({ room, isHost, connected, busy, onAction, onSetRounds }: Props) {
  const [viewedId, setViewedId] = useState<GameId | null>(() => room.selectedGame);
  const [page, setPage] = useState(0);
  const [browsingIndependently, setBrowsingIndependently] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const previousPick = useRef(room.selectedGame);
  const disabled = !connected || busy;
  const viewedGame = findGame(viewedId);
  const isViewingHostPick = Boolean(viewedId && room.selectedGame === viewedId);
  const isSelection = room.phase === "lobby" || room.phase === "selection" || room.phase === "instructions";
  const pageCount = Math.ceil(GAMES.length / 2); // Two cards per slide at every screen size.

  useEffect(() => {
    if (room.selectedGame !== previousPick.current) {
      if (!browsingIndependently || isHost) setViewedId(room.selectedGame);
      previousPick.current = room.selectedGame;
    }
  }, [room.selectedGame, browsingIndependently, isHost]);

  // When returning from a game's details, restore the slide it came from.
  // The browser never resets to page one unless the user explicitly goes there.
  useLayoutEffect(() => {
    if (viewedId !== null) return;
    const list = carouselRef.current;
    if (list) list.scrollLeft = page * list.clientWidth;
  }, [viewedId]);

  useEffect(() => {
    const restore = () => {
      const list = carouselRef.current;
      if (viewedId === null && list) list.scrollLeft = page * list.clientWidth;
    };
    window.addEventListener("resize", restore);
    return () => window.removeEventListener("resize", restore);
  }, [viewedId, page]);

  function select(gameId: GameId) {
    const game = findGame(gameId);
    if (!game) return;
    setPage(Math.floor(GAMES.findIndex(item => item.id === gameId) / 2));
    setViewedId(gameId);
    // Host selection is room-wide, even for upcoming games: the TV shows their
    // instructions, while the Start action remains unavailable until implemented.
    if (isHost && !disabled) {
      setBrowsingIndependently(false);
      if (gameId !== room.selectedGame) onAction("select_game", gameId);
    } else {
      setBrowsingIndependently(true);
    }
  }

  function showAll() {
    setViewedId(null);
    setBrowsingIndependently(true);
  }

  function returnToPick() {
    setViewedId(room.selectedGame);
    setBrowsingIndependently(false);
  }

  function scrollGames(direction: -1 | 1) {
    const next = Math.max(0, Math.min(pageCount - 1, page + direction));
    setPage(next);
    carouselRef.current?.scrollTo({ left: next * (carouselRef.current.clientWidth), behavior: "smooth" });
  }

  function onCarouselScroll() {
    const list = carouselRef.current;
    if (!list || list.clientWidth === 0) return;
    setPage(Math.max(0, Math.min(pageCount - 1, Math.round(list.scrollLeft / list.clientWidth))));
  }

  return (
    <section className="game-phase-panel" aria-live="polite">
      {isSelection && (
        <div className="game-selection-stage">
          {viewedGame ? (
            <div className={`game-detail-page game-detail-page--${viewedGame.id}`} key={viewedGame.id} style={{"--game-surface":gameAccent(viewedGame.id)} as CSSProperties}>
              <div className="game-detail-topline">
                <button type="button" className="game-detail-back" onClick={showAll}>← All games</button>
                {room.selectedGame && !isViewingHostPick && (
                  <button type="button" className="game-host-pick-control game-host-pick-control--detail" onClick={returnToPick}>
                    ↩ Host's Pick
                  </button>
                )}
              </div>
              <div className="game-detail-columns">
                <div className="game-detail-identity">
                  <div className="game-detail-title-row">
                    <span className="game-detail-icon" aria-hidden="true">{viewedGame.glyph}</span>
                    <h2>{viewedGame.title}</h2>
                  </div>
                  <p>{viewedGame.description}</p>
                  <span className="game-detail-count">{viewedGame.playerRange}</span>
                </div>
                <div className="game-detail-rules">
                  <h3>How to play</h3>
                  <ul>{viewedGame.instructions.map((rule, index) => <li key={`${index}-${rule}`}>{rule}</li>)}</ul>
                </div>
              </div>
              <div className="game-detail-footer">
                {viewedGame.id === "funny_answers" && isViewingHostPick ? (
                  <FunnySetup room={room} isHost={isHost} disabled={disabled}
                    onRoundsChange={onSetRounds} onStart={()=>onAction("show_game_instructions")} />
                ) : viewedGame.id === "last_word" && isViewingHostPick ? (
                  isHost ? <div className="game-detail-start">
                    {(room.players.length < 3 || room.players.length > 6) && <p className="funny-warning" role="status">3–6 players needed to play.</p>}
                    <button className="game-detail-play" disabled={disabled || room.players.length < 3 || room.players.length > 6} onClick={()=>onAction("show_game_instructions")}>Let's play →</button>
                  </div> : <p className="game-detail-wait">Waiting for host to start…</p>
                ) : (
                  <div className="game-detail-footer-note">
                    {!viewedGame.available
                      ? isViewingHostPick ? "Coming soon — selected for preview. This game can't start yet." : "Coming soon — preview the rules for now."
                      : "Only the host can start a game."}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="game-browse-view">
              <div className="selection-heading">
                <div className="selection-heading-left">
                  <h2>{isHost ? "Pick your poison." : "Browse games."}</h2>
                  <div className="game-carousel-controls" aria-label="Browse games">
                    <button className="secondary" type="button" onClick={() => scrollGames(-1)} disabled={page === 0} aria-label="Previous games">←</button>
                    <span className="game-carousel-page">{page + 1} / {pageCount}</span>
                    <button className="secondary" type="button" onClick={() => scrollGames(1)} disabled={page >= pageCount - 1} aria-label="Next games">→</button>
                  </div>
                </div>
                {room.selectedGame && (
                  <button type="button" className="game-host-pick-control" onClick={returnToPick}>
                    ↩ Host's Pick
                  </button>
                )}
              </div>
              <div className="game-card-grid game-carousel" ref={carouselRef} onScroll={onCarouselScroll} aria-label="Available games">
                {Array.from({ length: pageCount }, (_, slideIndex) => (
                  <div className="game-carousel-slide" key={slideIndex} role="group" aria-label={`Games ${slideIndex * 2 + 1}–${Math.min(GAMES.length, (slideIndex + 1) * 2)}`}>
                    {GAMES.slice(slideIndex * 2, slideIndex * 2 + 2).map(game => (
                      <GameCard key={game.id} game={game} selected={room.selectedGame === game.id}
                        disabled={isHost && disabled} onSelect={() => select(game.id)} />
                    ))}
                  </div>
                ))}
              </div>
              {!isHost && !room.selectedGame && <p className="game-waiting-note">Have a look around while the host chooses.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
