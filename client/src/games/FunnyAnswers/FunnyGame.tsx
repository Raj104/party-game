import { useEffect, useState } from "react";
import type { FunnyPrivate, Room } from "../../types/party";
import { FunnyBoard } from "./FunnyBoard";

type Props = {
  room: Room;
  privateState: FunnyPrivate;
  playerId: string | null;
  isHost: boolean;
  connected: boolean;
  busy: boolean;
  onAction: (event: string, payload?: string | number) => void;
};

export function FunnyGame({ room, privateState, playerId, isHost, connected, busy, onAction }: Props) {
  const game = room.funny;
  const [draft, setDraft] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const activeRound = game?.round;
  const savedAnswer = privateState && privateState.round === activeRound ? privateState.answer : "";
  const myAnswerId = privateState && privateState.round === activeRound ? privateState.ownAnswerId : null;
  const votedId = privateState && privateState.round === activeRound ? privateState.votedAnswerId : null;

  useEffect(() => { setDraft(savedAnswer); }, [savedAnswer, activeRound]);
  useEffect(() => { setChoice(null); }, [activeRound]);
  if (!game) return <p>Loading Hot Take...</p>;

  const playing = Boolean(playerId && game.participantIds.includes(playerId));
  const disabled = !connected || busy;
  function timerAction(command: "pause" | "resume" | "skip" | "next") {
    if (!game) return;
    if (command === "skip") {
      const question = game.stage === "results" ? (game.round === game.totalRounds ? "Show final standings now?" : `Start Round ${game.round + 1} now?`)
        : game.stage === "submission" ? "Close answer submission early?"
        : game.stage === "reveal" ? "Skip to the reading period?"
        : game.stage === "review" ? "Start voting now?" : "Close voting and score current votes?";
      if (!window.confirm(question)) return;
    }
    onAction("funny_timer_control", command);
  }
  return (
    <div className={`funny-player-game${playing ? "" : " funny-player-game--spectator"}`}
      data-voter-character={room.players.find(p => p.id === playerId)?.character ?? game.participants?.find(p => p.id === playerId)?.character ?? "scribble"}>
      <FunnyBoard
        game={game} players={room.players} serverNow={room.serverNow}
        showAnswers
        canVote={playing && game.stage === "voting"}
        voteChoice={choice}
        ownAnswerId={myAnswerId}
        votedAnswerId={votedId}
        onSelectVote={setChoice}
        voteDisabled={disabled}
        onConfirmVote={() => { if (choice) onAction("funny_submit_vote", choice); }}
        onTimerAction={isHost && game.stage !== "finished" ? timerAction : undefined}
        controlsDisabled={disabled}
      />
      {!playing && <div className="funny-interaction"><p>You're watching this game. Join the next one when it starts!</p></div>}
      {playing && game.stage === "submission" && (
        <section className="funny-interaction">
          <label htmlFor="funny-answer">Your answer (private until the reveal)</label>
          <textarea
            id="funny-answer" rows={3} maxLength={80}
            value={draft} onChange={(event) => setDraft(event.target.value)}
            disabled={!connected}
            placeholder="Make everyone laugh..."
          />
          <div className="funny-editor-footer">
            <small>{draft.length}/80 characters</small>
            <button className="primary" disabled={disabled || !draft.trim() || draft.trim() === savedAnswer}
              onClick={() => onAction("funny_submit_answer", draft)}>
              {savedAnswer ? "Update Answer" : "Submit Answer"}
            </button>
          </div>
          <p className="muted">{savedAnswer ? "Your answer is saved! Edit and update while submissions remain open." : "You can edit your answer until submissions close."}</p>
          <p className="muted">The round advances when everyone has submitted, even before the timer expires.</p>
        </section>
      )}
      {playing && (game.stage === "reveal" || game.stage === "review") && (
        <section className="funny-stage-note"><p>{game.stage === "review" ? "Read the answers. Voting starts soon." : "The answers are appearing…"}</p></section>
      )}
      {isHost && game.stage === "finished" && (
        <div className="funny-interaction funny-finish-actions"><button className="primary" disabled={disabled || room.players.filter(p=>p.connected).length<3 || room.players.filter(p=>p.connected).length>10} onClick={() => onAction("prepare_game_rematch")}>Play Hot Take Again</button><button className="secondary" disabled={disabled} onClick={() => onAction("funny_finish")}>Choose Another Game</button></div>
      )}
      {!isHost && game.stage === "finished" && <p className="muted">Waiting for the host to choose the next game...</p>}
    </div>
  );
}
