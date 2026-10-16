import { CharacterToken } from "./CharacterToken";
import type { CharacterId } from "../lib/preferences";

type Props = {
  name: string;
  character?: CharacterId;
  host?: boolean;
  offline?: boolean;
  compact?: boolean;
  you?: boolean;
};

export function PlayerIdentity({ name, character = "scribble", host = false, offline = false, compact = false, you = false }: Props) {
  return (
    <span className={`player-identity${compact ? " player-identity--compact" : ""}${offline ? " player-identity--offline" : ""}`}>
      <CharacterToken character={character} />
      <span className="player-identity-name" title={name}>{name}</span>
      {you && <span className="identity-you" aria-label="This is you">YOU</span>}
      {host && <span className="identity-host">HOST</span>}
      {offline && <span className="identity-offline">offline</span>}
    </span>
  );
}
