import { useState } from "react";

type Props = {
  connected: boolean;
  busy: boolean;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
};

export function JoinScreen({ connected, busy, onCreate, onJoin }: Props) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  return (
    <section className="panel">
      <h2>Welcome!</h2>
      <p className="muted">Enter a nickname to get started.</p>
      <label htmlFor="nickname">Your nickname</label>
      <input
        id="nickname"
        type="text"
        placeholder="Enter your name"
        value={name}
        maxLength={20}
        onChange={(event) => setName(event.target.value)}
      />
      <button className="primary" onClick={() => onCreate(name)} disabled={!connected || busy}>
        Create Room
      </button>
      <div className="divider">OR</div>
      <label htmlFor="room-code">Room code</label>
      <input
        id="room-code"
        type="text"
        placeholder="ABCD"
        value={roomCode}
        maxLength={4}
        onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
      />
      <button className="secondary" onClick={() => onJoin(roomCode, name)} disabled={!connected || busy}>
        Join Room
      </button>
    </section>
  );
}
