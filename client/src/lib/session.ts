import type { SavedSession } from "../types/party";

const SESSION_KEY = "party-game-player-session";

export function loadSession(): SavedSession | null {
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
    // Storage can be unavailable or malformed.
  }
  return null;
}

export function saveSession(code: string, token: string, playerId: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code, token, playerId }));
  } catch {
    // Browsers sometimes restrict session storage.
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage can be unavailable.
  }
}

export function getDisplayCode(): string | null {
  return new URLSearchParams(window.location.search).get("display")?.toUpperCase() ?? null;
}

export function getDisplayUrl(code: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set("display", code);
  return url.toString();
}

export function returnFromDisplay() {
  const url = new URL(window.location.href);
  url.searchParams.delete("display");
  window.location.assign(url.toString());
}
