import { GamePhasePanel } from "../components/GamePhasePanel";
import { PlayerList } from "../components/PlayerList";
import type { PartyRoomController } from "../hooks/usePartyRoom";

type Props = { party: PartyRoomController & { room: NonNullable<PartyRoomController["room"]> } };

export function RoomScreen({ party }: Props) {
  const { room, connected, gameActionBusy, isHost, copyCode, openDisplay, copyDisplayLink, leaveRoom, runGameAction } = party;
  return (
    <section className="panel">
      <p className="muted">YOUR ROOM CODE</p>
      <h2 className="room-code">{room.code}</h2>
      <button className="secondary" onClick={copyCode}>Copy Room Code</button>
      <p className="muted">Give this code to your friends so they can join!</p>
      <PlayerList players={room.players} />
      <GamePhasePanel
        room={room}
        isHost={isHost}
        connected={connected}
        busy={gameActionBusy}
        onAction={runGameAction}
      />
      {isHost ? (
        <>
          <p className="muted">You're the host! Set up your shared screen.</p>
          <div className="display-actions">
            <button className="primary" onClick={openDisplay}>Open Shared Display</button>
            <button className="secondary" onClick={copyDisplayLink}>Copy Shared Display Link</button>
          </div>
        </>
      ) : (
        <p className="muted">Waiting for the host to start a game...</p>
      )}
      {room.displayCount > 0 && (
        <div className="display-status">
          {room.displayCount} display{room.displayCount !== 1 ? "s" : ""} connected
        </div>
      )}
      <button className="danger" onClick={leaveRoom}>Leave Room</button>
    </section>
  );
}
