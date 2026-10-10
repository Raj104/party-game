import { SiteHeader } from "./components/SiteHeader";
import { usePartyRoom } from "./hooks/usePartyRoom";
import { DisplayScreen } from "./screens/DisplayScreen";
import { JoinScreen } from "./screens/JoinScreen";
import { RoomScreen } from "./screens/RoomScreen";
import "./App.css";
import "./GameSelection.css";

function App() {
  const party = usePartyRoom();

  if (party.displayCode) {
    return <DisplayScreen room={party.room} connected={party.connected} error={party.error} />;
  }

  return (
    <main className="app">
      <SiteHeader connected={party.connected} />
      {party.error && <div className="error" role="alert">{party.error}</div>}
      {party.restoring && !party.room ? (
        <section className="panel">
          <h2>Reconnecting...</h2>
          <p className="muted">Restoring your previous player session.</p>
        </section>
      ) : party.room ? (
        <RoomScreen party={{ ...party, room: party.room }} />
      ) : (
        <JoinScreen connected={party.connected} busy={party.busy} onCreate={party.createRoom} onJoin={party.joinRoom} />
      )}
      <footer>FFF • Early Access</footer>
    </main>
  );
}

export default App;
