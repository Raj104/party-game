import type { Room } from "../../types/party";

type Props = {
  room: Room;
  isHost: boolean;
  disabled: boolean;
  onRoundsChange: (rounds: number) => void;
  onStart: (rounds: number) => void;
};

export function FunnySetup({ room, isHost, disabled, onRoundsChange, onStart }: Props) {
  const online = room.players.filter(player => player.connected).length;
  const canStart = online >= 3 && online <= 10;
  const rounds = room.selectedRounds;

  return (
    <div className="funny-setup funny-setup--integrated">
      <div className="game-detail-rounds">
        <span className="game-detail-setting-label">Number of rounds</span>
        <fieldset className={`game-detail-round-choice${!isHost ? " game-detail-round-choice--readonly" : ""}`} disabled={!isHost || disabled}>
          <legend className="visually-hidden">{isHost ? "Choose number of rounds" : "Host's chosen round count"}</legend>
          {[3, 5].map(count => (
            <label key={count} className={`game-detail-round-option${rounds === count ? " is-active" : ""}`}>
              <input type="radio" name="funny-rounds" value={count} checked={rounds === count} onChange={() => isHost && onRoundsChange(count)} />
              {count} rounds
            </label>
          ))}
        </fieldset>
        {!isHost && <span className="game-detail-host-choice">Host's choice</span>}
        {isHost && <span className="game-detail-online">{online} connected · 3–10 needed</span>}
      </div>
      {isHost ? (
        <div className="game-detail-start">
          {!canStart && <p role="status" className="funny-warning">3–10 connected players needed to start.</p>}
          <button className="game-detail-play" disabled={disabled || !canStart} onClick={() => onStart(rounds)}>Let's play →</button>
        </div>
      ) : <p className="game-detail-wait">Waiting for host to start…</p>}
    </div>
  );
}
