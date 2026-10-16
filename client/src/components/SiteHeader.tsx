import type { ThemePreference } from "../hooks/useTheme";
import { ThemePicker } from "./ThemePicker";

type Props = {
  connected: boolean;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
};

export function SiteHeader({ connected, theme, onThemeChange }: Props) {
  return (
    <header className="header indie-header">
      <div className="indie-brand">
        <span className="indie-brand-mark">FFF<span className="brand-underline" /></span>
        <span className="indie-brand-caption">Fun with Friends &amp; Family</span>
      </div>
      <div className="indie-header-tools">
        <span className="indie-connection" title={connected ? "Connected to multiplayer server" : "Server disconnected"}>
          <span className={connected ? "online" : "offline"} />
          <span className="connection-label">{connected ? "Online" : "Offline"}</span>
        </span>
        <ThemePicker value={theme} onChange={onThemeChange}/>
      </div>
    </header>
  );
}
