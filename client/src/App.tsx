
import { useEffect, useState } from "react";
import { socket } from "./socket";
import "./App.css";
import "./GameSelection.css";

type Player = {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
};

type GameId = "funny_answers" | "drawing_telephone";
type GamePhase = "lobby" | "selection" | "instructions";

type GameInfo = {
  id: GameId;
  title: string;
  emoji: string;
  description: string;
  instructions: string[];
};

const GAMES: GameInfo[] = [
  {
    id: "funny_answers",
    title: "Funny Answers",
    emoji: "💬",
    description: "Write hilarious responses and vote for your favorites.",
    instructions: [
      "Everyone will receive a funny prompt on their own device.",
      "Write a creative answer before time runs out.",
      "Read the anonymous answers and vote for your favorite.",
      "Earn points from votes across multiple rounds!",
    ],
  },
  {
    id: "drawing_telephone",
    title: "Drawing Telephone",
    emoji: "🎨",
    description: "Turn words into drawings and drawings into guesses.",
    instructions: [
      "Each player starts with a short written prompt.",
      "The next player draws that prompt without using words.",
      "Another player describes what they think the drawing shows.",
      "Reveal the whole chain and enjoy the hilarious changes!",
    ],
  },
];

function findGame(gameId: GameId | null): GameInfo | undefined {
  return GAMES.find((game) => game.id === gameId);
}

type Room = {
  code: string;
  players: Player[];
  displayCount: number;
  phase: GamePhase;
  selectedGame: GameId | null;
};

type ActionResponse = { ok: true } | { ok: false; error: string };

type RoomResponse =
  | { ok: true; room: Room }
  | { ok: false; error: string };

type JoinResponse =
  | {
      ok: true;
      room: Room;
      token: string;
      playerId: string;
    }
  | { ok: false; error: string };

type SavedSession = {
  code: string;
  token: string;
  playerId: string;
};

const SESSION_KEY = "party-game-player-session";

const displayCode =
  new URLSearchParams(window.location.search)
    .get("display")
    ?.toUpperCase() ?? null;

// -------------------------------------
// SESSION STORAGE HELPERS
// -------------------------------------


function loadSession(): SavedSession | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    if (!value) return null;

    const session: unknown = JSON.parse(value);

    if (
      typeof session === "object" &&
      session !== null &&
      "code" in session &&
      "token" in session &&
      "playerId" in session &&
      typeof session.code === "string" &&
      typeof session.token === "string" &&
      typeof session.playerId === "string"
    ) {
      return {
        code: session.code,
        token: session.token,
        playerId: session.playerId,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function saveSession(
  code: string,
  token: string,
  playerId: string
) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ code, token, playerId })
    );
  } catch {
    // Storage might be restricted by the browser.
  }
}


function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

// -------------------------------------
// MAIN COMPONENT
// -------------------------------------

function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [room, setRoom] = useState<Room | null>(null);

  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gameActionBusy, setGameActionBusy] = useState(false);

  const [restoring, setRestoring] = useState(
    Boolean(!displayCode && loadSession())
  );

  useEffect(() => {
    let active = true;

    function onConnect() {
      if (!active) return;

      setConnected(true);
      setError("");

      // Shared displays reconnect using their URL.
      if (displayCode) {
        socket.emit(
          "watch_room",
          displayCode,
          (response: RoomResponse) => {
            if (!active) return;

            if (response.ok) {
              setRoom(response.room);
              setError("");
            } else {
              setRoom(null);
              setError(response.error);
            }
          }
        );

        return;
      }

      // Restore a player if a saved session exists.
      const saved = loadSession();

      if (saved) {
        setRestoring(true);

        socket.emit(
          "resume_room",
          saved.code,
          saved.token,
          (response: RoomResponse) => {
            if (!active) return;

            setRestoring(false);

            if (response.ok) {
              setRoom(response.room);
              setError("");
            } else {
              clearSession();
              setRoom(null);
              setError(response.error);
            }
          }
        );
      } else {
        setRestoring(false);
        setRoom(null);
      }
    }

    function onDisconnect() {
      if (!active) return;

      setConnected(false);
      setRoom(null);
      setBusy(false);
      setGameActionBusy(false);

      if (!displayCode) {
        setRestoring(Boolean(loadSession()));
      }
    }

    function onRoomUpdated(updatedRoom: Room) {
      if (!active) return;

      if (displayCode) {
        if (updatedRoom.code === displayCode) {
          setRoom(updatedRoom);
        }
      } else {
        const saved = loadSession();

        if (saved?.code === updatedRoom.code) {
          setRoom(updatedRoom);
        }
      }
    }

    function onRoomClosed() {
      if (!active) return;

      if (!displayCode) clearSession();

      setRoom(null);
      setRestoring(false);
      setError("This room has closed.");
    }

    function onSessionReplaced() {
      if (!active) return;

      clearSession();
      setRoom(null);
      setRestoring(false);
      setError(
        "This player session was opened in another tab."
      );
    }

    function onConnectError() {
      if (!active) return;

      setError("Cannot connect to the multiplayer server.");
      setBusy(false);
      setGameActionBusy(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room_updated", onRoomUpdated);
    socket.on("room_closed", onRoomClosed);
    socket.on("session_replaced", onSessionReplaced);
    socket.on("connect_error", onConnectError);

    if (socket.connected) {
      onConnect();
    } else {
      socket.connect();
    }

    return () => {
      active = false;

      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_updated", onRoomUpdated);
      socket.off("room_closed", onRoomClosed);
      socket.off("session_replaced", onSessionReplaced);
      socket.off("connect_error", onConnectError);

      socket.disconnect();
    };
  }, []);

  // -------------------------------------
  // PLAYER ROOM ACTIONS
  // -------------------------------------

  function handleJoinResponse(response: JoinResponse) {
    setBusy(false);

    if (response.ok) {
      saveSession(response.room.code, response.token, response.playerId);
      setRoom(response.room);
      setError("");
      setRestoring(false);
    } else {
      setError(response.error);
    }
  }

  function createRoom() {
    if (!connected || busy || restoring) return;

    if (!name.trim()) {
      setError("Please enter your nickname.");
      return;
    }

    setBusy(true);
    setError("");

    socket.emit(
      "create_room",
      name.trim(),
      handleJoinResponse
    );
  }

  function joinRoom() {
    if (!connected || busy || restoring) return;

    if (!name.trim()) {
      setError("Please enter your nickname.");
      return;
    }

    if (roomCode.trim().length !== 4) {
      setError("Room codes must be 4 letters.");
      return;
    }

    setBusy(true);
    setError("");

    socket.emit(
      "join_room",
      roomCode.trim().toUpperCase(),
      name.trim(),
      handleJoinResponse
    );
  }

  function leaveRoom() {
    socket.emit("leave_room");

    clearSession();
    setRoom(null);
    setError("");
    setRestoring(false);
  }

  async function copyCode() {
    if (!room) return;

    try {
      await navigator.clipboard.writeText(room.code);
    } catch {
      setError("Couldn't copy the room code.");
    }
  }

  // -------------------------------------
  // HOST-ONLY GAME SELECTION ACTIONS
  // -------------------------------------

  function runGameAction(event: string, gameId?: GameId) {
    if (!socket.connected || gameActionBusy) return;

    setGameActionBusy(true);
    setError("");

    const onResponse = (response: ActionResponse) => {
      setGameActionBusy(false);
      if (!response.ok) setError(response.error);
    };

    if (gameId) {
      socket.emit(event, gameId, onResponse);
    } else {
      socket.emit(event, onResponse);
    }
  }

  // -------------------------------------
  // SHARED DISPLAY ACTIONS
  // -------------------------------------

  function getDisplayUrl(code: string): string {
    const url = new URL(window.location.href);
    url.searchParams.set("display", code);
    return url.toString();
  }

  function openDisplay() {
    if (!room) return;

    window.open(
      getDisplayUrl(room.code),
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function copyDisplayLink() {
    if (!room) return;

    try {
      await navigator.clipboard.writeText(
        getDisplayUrl(room.code)
      );
    } catch {
      setError("Couldn't copy the Shared Display link.");
    }
  }

  function returnHome() {
    const url = new URL(window.location.href);
    url.searchParams.delete("display");
    window.location.assign(url.toString());
  }

  const currentPlayer = room?.players.find(
    (player) => player.id === loadSession()?.playerId
  );
  const isHost = Boolean(currentPlayer?.isHost);
  const selectedGame = room ? findGame(room.selectedGame) : undefined;

  // -------------------------------------
  // SHARED DISPLAY
  // -------------------------------------

  if (displayCode) {
    return (
      <main className="tv-screen">
        <header className="tv-header">
          <h1>FFF | Fun with Friends & Family</h1>
          <span className="tv-badge">SHARED DISPLAY</span>
        </header>

        {room ? (
          <div className="tv-content">
            <p className="tv-label">JOIN THE PARTY!</p>

            <h2 className="tv-code">{room.code}</h2>

            <p className="tv-instructions">
              Open the Game website on your phone
              and enter the room code!
            </p>

            {room.phase === "selection" && (
              <section className="game-phase-panel" aria-live="polite">
                <p className="game-eyebrow">GAME SELECTION</p>
                <h2>Choosing a mini-game</h2>
                {selectedGame ? (
                  <p className="game-big-choice">
                    {selectedGame.emoji} {selectedGame.title}
                  </p>
                ) : (
                  <p>Waiting for the host to pick a game...</p>
                )}
              </section>
            )}

            {room.phase === "instructions" && selectedGame && (
              <section className="game-phase-panel" aria-live="polite">
                <p className="game-eyebrow">HOW TO PLAY</p>
                <h2>{selectedGame.emoji} {selectedGame.title}</h2>
                <ol className="game-instructions">
                  {selectedGame.instructions.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="muted">Gameplay is coming in the next milestone.</p>
              </section>
            )}

            <section className="tv-players">
              <h2>
                Players ({room.players.length}/12)
              </h2>

              <div className="tv-player-grid">
                {room.players.map((player) => (
                  <div
                    className={
                      "tv-player" +
                      (!player.connected
                        ? " offline-player"
                        : "")
                    }
                    key={player.id}
                  >
                    <span className="tv-avatar">
                      {player.isHost ? "👑" : "🎮"}
                    </span>

                    <span>{player.name}</span>

                    {!player.connected && (
                      <span className="player-status">
                        Reconnecting...
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <div className="tv-waiting">
              <span className="pulse-dot" />
              {room.phase === "lobby"
                ? "Waiting for the game to start..."
                : room.phase === "selection"
                  ? "Host is selecting a game..."
                  : "Get ready to play!"}
            </div>
          </div>
        ) : (
          <div className="tv-content">
            <h2>
              {connected
                ? "Room Unavailable"
                : "Connecting..."}
            </h2>

            <p className="tv-instructions">
              {error ||
                "Connecting to the multiplayer server..."}
            </p>

            <button
              className="secondary"
              onClick={returnHome}
            >
              Return to Home
            </button>
          </div>
        )}

        <footer className="tv-footer">
          FFF • Shared Screen Mode
        </footer>
      </main>
    );
  }

  // -------------------------------------
  // NORMAL PLAYER LOBBY
  // -------------------------------------

  return (
    <main className="app">
      <header className="header">
        <h1>FFF</h1>
        <p>Fun with Friends & Family</p>

        <div className="connection">
          <span
            className={connected ? "online" : "offline"}
          />
          {connected
            ? "Server Connected"
            : "Disconnected"}
        </div>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {restoring && !room ? (
        <section className="panel">
          <h2>Reconnecting...</h2>
          <p className="muted">
            Restoring your previous player session.
          </p>
        </section>
      ) : !room ? (
        <section className="panel">
          <h2>Welcome!</h2>

          <p className="muted">
            Enter a nickname to get started.
          </p>

          <label htmlFor="nickname">
            Your nickname
          </label>

          <input
            id="nickname"
            type="text"
            placeholder="Enter your name"
            value={name}
            maxLength={20}
            onChange={(event) =>
              setName(event.target.value)
            }
          />

          <button
            className="primary"
            onClick={createRoom}
            disabled={!connected || busy}
          >
            Create Room
          </button>

          <div className="divider">OR</div>

          <label htmlFor="room-code">
            Room code
          </label>

          <input
            id="room-code"
            type="text"
            placeholder="ABCD"
            value={roomCode}
            maxLength={4}
            onChange={(event) =>
              setRoomCode(
                event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z]/g, "")
              )
            }
          />

          <button
            className="secondary"
            onClick={joinRoom}
            disabled={!connected || busy}
          >
            Join Room
          </button>
        </section>
      ) : (
        <section className="panel">
          <p className="muted">
            YOUR ROOM CODE
          </p>

          <h2 className="room-code">
            {room.code}
          </h2>

          <button
            className="secondary"
            onClick={copyCode}
          >
            Copy Room Code
          </button>

          <p className="muted">
            Give this code to your friends so they can join!
          </p>

          <div className="room-info">
            <h3>
              Players ({room.players.length}/12)
            </h3>

            <div className="player-list">
              {room.players.map((player) => (
                <div
                  className={
                    "player" +
                    (!player.connected
                      ? " offline-player"
                      : "")
                  }
                  key={player.id}
                >
                  <span>
                    {player.isHost ? "👑 " : "🎮 "}
                    {player.name}
                    {!player.connected && " (Offline)"}
                  </span>

                  {player.isHost && (
                    <span className="host-tag">
                      HOST
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <section className="game-phase-panel" aria-live="polite">
            {room.phase === "lobby" && (
              <>
                <p className="game-eyebrow">LOBBY</p>
                <h3>Ready for a mini-game?</h3>
                {isHost ? (
                  <button
                    className="primary"
                    onClick={() => runGameAction("open_game_selection")}
                    disabled={!connected || gameActionBusy}
                  >
                    Choose a Game
                  </button>
                ) : (
                  <p className="muted">Waiting for the host to choose a game...</p>
                )}
              </>
            )}

            {room.phase === "selection" && (
              <>
                <p className="game-eyebrow">GAME SELECTION</p>
                <h3>Pick a mini-game</h3>
                <div className="game-card-grid">
                  {GAMES.map((game) => (
                    <button
                      type="button"
                      key={game.id}
                      className={
                        "game-choice-card" +
                        (room.selectedGame === game.id ? " game-choice-selected" : "")
                      }
                      onClick={() => runGameAction("select_game", game.id)}
                      disabled={!isHost || !connected || gameActionBusy}
                      aria-pressed={room.selectedGame === game.id}
                    >
                      <span className="game-choice-emoji">{game.emoji}</span>
                      <strong>{game.title}</strong>
                      <span>{game.description}</span>
                      {room.selectedGame === game.id && (
                        <span className="game-selected-label">✓ Selected</span>
                      )}
                    </button>
                  ))}
                </div>
                {isHost ? (
                  <div className="game-phase-actions">
                    <button
                      className="primary"
                      onClick={() => runGameAction("show_game_instructions")}
                      disabled={!connected || gameActionBusy || !room.selectedGame}
                    >
                      Show Instructions
                    </button>
                    <button
                      className="secondary"
                      onClick={() => runGameAction("return_to_lobby")}
                      disabled={!connected || gameActionBusy}
                    >
                      Back to Lobby
                    </button>
                  </div>
                ) : (
                  <p className="muted">The host is choosing the next game...</p>
                )}
              </>
            )}

            {room.phase === "instructions" && selectedGame && (
              <>
                <p className="game-eyebrow">HOW TO PLAY</p>
                <h3>{selectedGame.emoji} {selectedGame.title}</h3>
                <ol className="game-instructions">
                  {selectedGame.instructions.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="muted">
                  The actual gameplay comes in our next milestone.
                </p>
                {isHost && (
                  <div className="game-phase-actions">
                    <button
                      className="secondary"
                      onClick={() => runGameAction("back_to_game_selection")}
                      disabled={!connected || gameActionBusy}
                    >
                      Change Game
                    </button>
                    <button
                      className="secondary"
                      onClick={() => runGameAction("return_to_lobby")}
                      disabled={!connected || gameActionBusy}
                    >
                      Back to Lobby
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {currentPlayer?.isHost ? (
            <>
              <p className="muted">
                You're the host! Set up your shared screen.
              </p>

              <div className="display-actions">
                <button
                  className="primary"
                  onClick={openDisplay}
                >
                  Open Shared Display
                </button>

                <button
                  className="secondary"
                  onClick={copyDisplayLink}
                >
                  Copy Shared Display Link
                </button>
              </div>
            </>
          ) : (
            <p className="muted">
              Waiting for the host to start a game...
            </p>
          )}

          {room.displayCount > 0 && (
            <div className="display-status">
              {room.displayCount} display
              {room.displayCount !== 1 ? "s" : ""}
              {" "}connected
            </div>
          )}

          <button
            className="danger"
            onClick={leaveRoom}
          >
            Leave Room
          </button>
        </section>
      )}

      <footer>
        FFF • Early Access
      </footer>
    </main>
  );
}

export default App;
