import type { GameInfo } from "../types/party";

type Props = {
  game: GameInfo;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
};

export function GameCard({ game, selected, disabled, onSelect }: Props) {
  return (
    <button
      type="button"
      className={"game-choice-card" + (selected ? " game-choice-selected" : "")}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
    >
      <span className="game-choice-emoji">{game.emoji}</span>
      <strong>{game.title}</strong>
      <span>{game.description}</span>
      {selected && <span className="game-selected-label">✓ Selected</span>}
    </button>
  );
}
