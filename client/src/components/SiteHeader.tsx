type Props = { connected: boolean };

export function SiteHeader({ connected }: Props) {
  return (
    <header className="header">
      <h1>FFF</h1>
      <p>Fun with Friends &amp; Family</p>
      <div className="connection">
        <span className={connected ? "online" : "offline"} />
        {connected ? "Server Connected" : "Disconnected"}
      </div>
    </header>
  );
}
