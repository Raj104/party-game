import { SiteHeader } from "./components/SiteHeader";
import { usePartyRoom } from "./hooks/usePartyRoom";
import { useTheme } from "./hooks/useTheme";
import { DisplayScreen } from "./screens/DisplayScreen";
import { JoinScreen } from "./screens/JoinScreen";
import { RoomScreen } from "./screens/RoomScreen";
import "./styles/index.css";

function App() {
  const party = usePartyRoom();
  const { theme, setTheme } = useTheme();

  if (party.displayCode) {
    return <DisplayScreen room={party.room} connected={party.connected} error={party.error} theme={theme} onThemeChange={setTheme} />;
  }

  return (
    <main className={`app ${party.room ? "app--room" : "app--home"}`}>
      <SiteHeader connected={party.connected} theme={theme} onThemeChange={setTheme} />
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
      <footer className="indie-footer">FFF — Fun with Friends &amp; Family · Made for questionable company.</footer>
    </main>
  );
}

export default App;
