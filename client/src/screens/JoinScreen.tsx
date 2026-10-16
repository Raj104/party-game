import { useState, type FormEvent } from "react";
import { CharacterToken } from "../components/CharacterToken";
import { CHARACTERS, getStoredCharacter, getStoredNickname, saveCharacter, saveNickname } from "../lib/preferences";
import { getJoinCode, normalizeCode } from "../lib/session";
import type { CharacterId } from "../lib/preferences";

type Props = {
  connected: boolean;
  busy: boolean;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
};

export function JoinScreen({ connected, busy, onCreate, onJoin }: Props) {
  const invitedCode = getJoinCode();
  const [name, setName] = useState(getStoredNickname);
  const [roomCode, setRoomCode] = useState(invitedCode ?? "");
  const [mode, setMode] = useState<"create" | "join">(invitedCode ? "join" : "create");
  const [character, setCharacter] = useState<CharacterId>(getStoredCharacter);

  function updateName(next: string) {
    setName(next);
    saveNickname(next);
  }

  function updateCharacter(next: CharacterId) {
    setCharacter(next);
    saveCharacter(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connected || busy || !name.trim()) return;
    if (mode === "create") onCreate(name.trim());
    else if (normalizeCode(roomCode)) onJoin(roomCode, name.trim());
  }

  return (
    <section className="indie-home" aria-label="Create or join a game room">
      <div className="indie-home-intro">
        <div className="indie-eyebrow">THE UNOFFICIAL OFFICIAL HANGOUT</div>
        <h1>Good games.<br /><span>Bad decisions.</span></h1>
        <p>A little competition. A lot of nonsense.</p>
        <div className="indie-doodles" aria-hidden="true">
          <span className="doodle-sun">✳</span>
          <span className="doodle-line">〰</span>
          <span className="doodle-arrow">↘</span>
        </div>
      </div>
      <form className="indie-join-card" onSubmit={submit}>
        <div className="indie-mode-tabs" role="group" aria-label="Room action">
          <button type="button" aria-pressed={mode === "create"} className={mode === "create" ? "is-active" : ""} onClick={() => setMode("create")}>Create a room</button>
          <button type="button" aria-pressed={mode === "join"} className={mode === "join" ? "is-active" : ""} onClick={() => setMode("join")}>Join a room</button>
        </div>
        <div className="indie-join-card-body">
          <div className="join-mode-copy">
            <h2>{mode === "create" ? "Start something." : "Get in here."}</h2>
            <p>{mode === "create" ? "Make a room, send the link, cause some chaos." : "Got a code or invite link? You're halfway there."}</p>
          </div>
          <label htmlFor="nickname">YOUR NICKNAME</label>
          <input id="nickname" type="text" autoComplete="nickname" placeholder="What should we call you?" value={name}
            maxLength={20} required onChange={(event) => updateName(event.target.value)} />

          <fieldset className="character-picker">
            <legend>YOUR LITTLE WEIRDO <span>· pick a token</span></legend>
            <div className="character-options">
              {CHARACTERS.map((item) => (
                <button key={item.id} type="button" title={item.label} aria-label={item.label} aria-pressed={character === item.id}
                  className={character === item.id ? "is-picked" : ""} onClick={() => updateCharacter(item.id)}>
                  <CharacterToken character={item.id} size="large" />
                </button>
              ))}
            </div>
          </fieldset>
          {mode === "join" && (
            <div className="join-code-field">
              <label htmlFor="room-code">ROOM CODE</label>
              <input id="room-code" type="text" inputMode="text" autoCapitalize="characters" placeholder="happy-otter" value={roomCode}
                maxLength={13} required onChange={(event) => setRoomCode(event.target.value.toLowerCase().replace(/[^a-z-]/g, ""))} />
              {invitedCode && <small>Invite code filled in for you. Just enter your nickname.</small>}
            </div>
          )}
          <button className="primary indie-submit" type="submit" disabled={!connected || busy || !name.trim() || (mode === "join" && !normalizeCode(roomCode))}>
            {busy ? "One sec…" : mode === "create" ? "Create room  ↗" : "Join party  ↗"}
          </button>
          <p className="indie-privacy-note">Developer is not responsible for any damages.</p>
        </div>
      </form>
    </section>
  );
}
