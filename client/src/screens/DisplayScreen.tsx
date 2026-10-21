import { PlayerList } from "../components/PlayerList";
import { ThemePicker } from "../components/ThemePicker";
import { JoinQrCode } from "../components/JoinQrCode";
import { LastWordGame } from "../games/LastWord/LastWordGame";
import { FunnyDisplay } from "../games/FunnyAnswers/FunnyDisplay";
import { findGame } from "../data/games";
import { returnFromDisplay } from "../lib/session";
import type { ThemePreference } from "../hooks/useTheme";
import type { Room } from "../types/party";

type Props = { room: Room | null; connected: boolean; error: string; theme: ThemePreference; onThemeChange: (theme: ThemePreference) => void };

export function DisplayScreen({ room, connected, error, theme, onThemeChange }: Props) {
  const selectedGame = room ? findGame(room.selectedGame) : undefined;
  const hostName = room?.players.find(player => player.isHost)?.name;
  const hostRoomTitle = hostName ? `${hostName}${/s$/i.test(hostName) ? "’" : "’s"} Room` : "Your Party Room";
  const playing = room?.phase === "playing" && Boolean(room.funny || room.lastWord);
  return (
    <main className={`tv-screen${playing ? " tv-screen--playing" : ""}`}>
      <header className="tv-header">
        <div className="tv-brand"><strong>FFF</strong><span>FUN WITH FRIENDS &amp; FAMILY</span></div>
        <div className="tv-header-actions">
          {room && (playing ? <strong className="tv-header-room-code">{room.code}</strong> : <strong className="tv-host-room-title">{hostRoomTitle}</strong>)}
          <ThemePicker value={theme} onChange={onThemeChange}/>
        </div>
      </header>
      {room ? (
        <div className={`tv-content${playing ? " tv-content--game" : " tv-content--lobby"}`}>
          {playing && room.lastWord ? <LastWordGame room={room} playerId={null} isHost={false} connected={connected} onAction={()=>{}} display/> : playing && room.funny ? <FunnyDisplay room={room} /> : (
            <>
              <div className="tv-lobby-hero">
                <p className="tv-lobby-invite-label">JOIN THIS ROOM</p>
                <div className="tv-lobby-code">{room.code}</div>
                <p className="tv-lobby-invite-hint">Ask the host for an invite link or scan the below QR code.</p>
                <JoinQrCode code={room.code} />
              </div>
              <div className="tv-lobby-side">
                <p className="game-eyebrow">{room.players.length} HERE SO FAR</p>
                <PlayerList players={room.players} variant="tv" />
                {room.phase !== "lobby" && selectedGame ? (
                  <div className="tv-game-preview" aria-live="polite">
                    <div className="tv-game-preview-heading">
                      <span className="tv-game-preview-icon" aria-hidden="true">{selectedGame.glyph}</span>
                      <div><p className="game-eyebrow">UP NEXT</p><h2>{selectedGame.title}</h2></div>
                    </div>
                    <h3>How to play</h3>
                    <ul className="tv-game-instructions">
                      {selectedGame.instructions.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
                    </ul>
                    <p className="tv-waiting">{selectedGame.available ? room.selectedGame === "last_word" ? "Players tap Ready · Host starts when everyone is ready" : `Host is setting up the game · ${room.selectedRounds} rounds` : "Coming soon · Host is previewing this game"}</p>
                  </div>
                ) : (
                  <p className="tv-waiting">{room.phase === "lobby" ? "Waiting for the host to choose a game." : "Host is picking the next game."}</p>
                )}
              </div>
            </>
          )}
        </div>
      ) : <div className="tv-content tv-content--unavailable">
        <h1>{connected ? "Room unavailable." : "Connecting…"}</h1>
        <p>{error || "Connecting to the multiplayer server…"}</p>
        <p className="tv-connection-hint">A shared display can only stay open while its room still exists.</p>
        <button className="secondary" onClick={returnFromDisplay}>Back home</button>
      </div>}
      {playing && room ? (
        <footer className="tv-permanent-invite tv-game-invite" aria-label="Join this room">
          <div className="tv-permanent-qr">
            <JoinQrCode code={room.code} compact />
          </div>
          <strong className="tv-game-host-title">{hostRoomTitle}</strong>
        </footer>
      ) : <footer className="tv-footer">A little competition. A lot of nonsense.</footer>}
    </main>
  );
}
