import type { SavedSession } from "../types/party";

const SESSION_KEY = "party-game-player-session";
// Keep normal persistent recovery unless explicitly disabled while developing.
const disableDevReconnect = import.meta.env.DEV && import.meta.env.VITE_DISABLE_RECONNECT === "true";

export function loadSession(): SavedSession | null {
  try {
    // Persistent credentials allow recovery after closing a tab or the browser.
    // Existing tabs keep their own identities. A fresh tab can recover from
    // localStorage after an accidental closure.
    let value: string | null = null;
    try { value = sessionStorage.getItem(SESSION_KEY); } catch { /* restricted storage */ }
    if (!value && !disableDevReconnect) {
      try { value = localStorage.getItem(SESSION_KEY); } catch { /* restricted storage */ }
    }
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
    const value = JSON.stringify({ code, token, playerId });
    if (!disableDevReconnect) {
      try { localStorage.setItem(SESSION_KEY, value); } catch { /* restricted storage */ }
    }
    try { sessionStorage.setItem(SESSION_KEY, value); } catch { /* restricted storage */ }
  } catch {
    // Browsers sometimes restrict session storage.
  }
}

export function clearSession() {
  try {
    // A different player may have joined in another tab. Never erase that
    // newer shared recovery token when this tab signs out.
    let tabValue: string | null = null;
    let sharedValue: string | null = null;
    try { tabValue = sessionStorage.getItem(SESSION_KEY); } catch { /* restricted storage */ }
    try { sharedValue = localStorage.getItem(SESSION_KEY); } catch { /* restricted storage */ }
    if (disableDevReconnect || !tabValue || tabValue === sharedValue) {
      try { localStorage.removeItem(SESSION_KEY); } catch { /* restricted storage */ }
    }
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* restricted storage */ }
  } catch {
    // Storage can be unavailable.
  }
}

// New adjective–noun names plus legacy four-letter codes during migration.
export function normalizeCode(value: string): string | null {
  const text = value.trim();
  if (/^[a-z]{4}$/i.test(text)) return text.toUpperCase();
  return /^[a-z]{4,6}-[a-z]{4,6}$/i.test(text) ? text.toLowerCase() : null;
}

export function getDisplayCode(): string | null {
  return normalizeCode(new URLSearchParams(window.location.search).get("display") ?? "");
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

// Invite links accept memorable names or four-letter legacy codes.
export function getJoinCode(): string | null {
  return normalizeCode(new URLSearchParams(window.location.search).get("join") ?? "");
}

export function getInviteUrl(code: string): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("display");
  url.searchParams.set("join", code);
  return url.toString();
}

export function clearInviteParameter() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("join")) return;
  url.searchParams.delete("join");
  window.history.replaceState(null, "", url.toString());
}
