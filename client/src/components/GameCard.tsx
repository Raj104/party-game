import type { CSSProperties } from "react";
import { gameAccent } from "../data/games";
import type { GameInfo } from "../types/party";

type Props = { game: GameInfo; selected: boolean; disabled: boolean; onSelect: () => void };

export function GameCard({ game, selected, disabled, onSelect }: Props) {
  return (
    <button type="button"
      className={`game-choice-card game-choice-card--${game.id}${selected ? " game-choice-selected" : ""}`}
      style={{ "--game-surface": gameAccent(game.id) } as CSSProperties}
      onClick={onSelect} disabled={disabled} aria-pressed={selected}
      aria-label={`${game.title}. ${game.available ? game.playerRange : "Preview, coming soon"}. Read details.`}>
      <span className="game-choice-title-row">
        <span className="game-choice-doodle" aria-hidden="true">{game.glyph}</span>
        <strong>{game.title}</strong>
      </span>
      <span className="game-choice-description">{game.description}</span>
      <small className="game-choice-meta">{game.playerRange}</small>
      {selected && <span className="game-selected-label">Host's pick ✓</span>}
    </button>
  );
}
