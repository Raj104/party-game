import { useEffect, useState } from "react";
import { socket } from "../socket";
import { getStoredCharacter } from "../lib/preferences";
import { copyWithFallback } from "../lib/clipboard";
import { clearInviteParameter, clearSession, getDisplayCode, getDisplayUrl, getInviteUrl, getJoinCode, normalizeCode, loadSession, saveSession } from "../lib/session";
import type { ActionResponse, FunnyPrivate, GameId, JoinResponse, Room, RoomResponse } from "../types/party";

// Socket events, connection recovery, and player actions all live here.
// Screens only receive room state and callbacks; they never own a socket.
const displayCode = getDisplayCode();
// Opt-in only, and ignored by production builds.
// Set VITE_DISABLE_RECONNECT=true in client/.env.development.local to test
// multiple independent player tabs in one browser.
const disableDevReconnect = import.meta.env.DEV && import.meta.env.VITE_DISABLE_RECONNECT === "true";

export function usePartyRoom() {
  const [connected, setConnected] = useState(socket.connected);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gameActionBusy, setGameActionBusy] = useState(false);
  const [funnyPrivate, setFunnyPrivate] = useState<FunnyPrivate>(null);
  const [funnyBusy, setFunnyBusy] = useState(false);
  const [restoring, setRestoring] = useState(Boolean(!disableDevReconnect && !displayCode && loadSession() && (!getJoinCode() || loadSession()?.code === getJoinCode())));

  useEffect(() => {
    let active = true;
    let superseded = false;

    function onConnect() {
      if (!active) return;
      setConnected(true);
      setError("");

      if (displayCode) {
        socket.emit("watch_room", displayCode, (response: RoomResponse) => {
          if (!active) return;
          if (response.ok) {
            setRoom(response.room);
            setError("");
          } else {
            setRoom(null);
            setError(response.error);
          }
        });
        return;
      }

      if (disableDevReconnect) {
        setRestoring(false);
        setRoom(null);
        return;
      }

      const saved = loadSession();
      if (saved && (!getJoinCode() || saved.code === getJoinCode())) {
        setRestoring(true);
        socket.emit("resume_room", saved.code, saved.token, (response: RoomResponse) => {
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
        });
      } else {
        // A new invite takes priority over a different room saved in this tab.
        // Keep the other room recovery credentials until the player explicitly joins/leaves.
        setRestoring(false);
        setRoom(null);
      }
    }

    function onDisconnect() {
      if (!active) return;
      setConnected(false);
      setRoom(previous => previous?.phase === "playing" && previous.lastWord ? previous : null);
      setFunnyPrivate(null);
      setBusy(false);
      setFunnyBusy(false);
      setGameActionBusy(false);
      if (!displayCode) setRestoring(!disableDevReconnect && !superseded && Boolean(loadSession()));
    }

    function onRoomUpdated(updatedRoom: Room) {
      if (!active) return;
      if (displayCode) {
        if (updatedRoom.code === displayCode) setRoom(updatedRoom);
      } else if (loadSession()?.code === updatedRoom.code) {
        setRoom(updatedRoom);
      }
    }

    function onFunnyPrivateUpdated(next: FunnyPrivate) {
      if (active && !displayCode) setFunnyPrivate(next);
    }

    function onRoomClosed() {
      if (!active) return;
      if (!displayCode) clearSession();
      setFunnyPrivate(null);
      setRoom(null);
      setRestoring(false);
      setError("This room has closed.");
    }

    function onSessionReplaced() {
      if (!active) return;
      superseded = true;
      // The new tab shares localStorage; do not erase its valid credentials.
      setFunnyPrivate(null);
      setRoom(null);
      setRestoring(false);
      setError("This player session was opened in another tab.");
    }

    function onRoomKicked() {
      if (!active) return;
      clearSession();
      setFunnyPrivate(null);
      setRoom(null);
      setRestoring(false);
      setError("The host removed you from the room. You can join again as a new player.");
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
    socket.on("funny_private_updated", onFunnyPrivateUpdated);
    socket.on("room_closed", onRoomClosed);
    socket.on("session_replaced", onSessionReplaced);
    socket.on("room_kicked", onRoomKicked);
    socket.on("connect_error", onConnectError);
    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      active = false;
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_updated", onRoomUpdated);
      socket.off("funny_private_updated", onFunnyPrivateUpdated);
      socket.off("room_closed", onRoomClosed);
      socket.off("session_replaced", onSessionReplaced);
      socket.off("room_kicked", onRoomKicked);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
    };
  }, []);

  function handleJoinResponse(response: JoinResponse) {
    setBusy(false);
    if (response.ok) {
      saveSession(response.room.code, response.token, response.playerId);
      clearInviteParameter();
      setRoom(response.room);
      setError("");
      setRestoring(false);
    } else {
      setError(response.error);
    }
  }

  function createRoom(name: string) {
    if (!connected || busy || restoring) return;
    if (!name.trim()) return setError("Please enter your nickname.");
    setBusy(true);
    setError("");
    socket.emit("create_room", name.trim(), getStoredCharacter(), handleJoinResponse);
  }

  function joinRoom(code: string, name: string) {
    if (!connected || busy || restoring) return;
    if (!name.trim()) return setError("Please enter your nickname.");
    const normalized = normalizeCode(code);
    if (!normalized) return setError("Enter a room name like happy-otter.");
    setBusy(true);
    setError("");
    socket.emit("join_room", normalized, name.trim(), getStoredCharacter(), handleJoinResponse);
  }

  function leaveRoom() {
    socket.emit("leave_room");
    clearSession();
    setFunnyPrivate(null);
    setRoom(null);
    setError("");
    setRestoring(false);
  }

  function runGameAction(event: string, payload?: GameId | number | string) {
    if (!socket.connected || gameActionBusy) return;
    setGameActionBusy(true);
    setError("");
    const onResponse = (response: ActionResponse) => {
      setGameActionBusy(false);
      if (!response.ok) setError(response.error);
    };
    if (payload !== undefined) socket.emit(event, payload, onResponse);
    else socket.emit(event, onResponse);
  }

  function runFunnyAction(event: string, payload?: string | number) {
    if (!socket.connected || funnyBusy) return;
    setFunnyBusy(true);
    setError("");
    const onResponse = (response: ActionResponse) => {
      setFunnyBusy(false);
      if (!response.ok) setError(response.error);
    };
    if (payload !== undefined) socket.emit(event, payload, onResponse);
    else socket.emit(event, onResponse);
  }

  function runLastWordAction(event: string, payload?: unknown, done?: (response: ActionResponse) => void) {
    if (!socket.connected) { done?.({ok:false,error:"Reconnecting…"});return; }
    const callback=(response:ActionResponse)=>{
      if(!response.ok && event!=="last_word_submit" && !done) setError(response.error);
      done?.(response);
    };
    if(payload===undefined) socket.emit(event,callback);
    else socket.emit(event,payload,callback);
  }

  async function copyCode() {
    if (!room) return;
    await copyWithFallback(room.code, "room name");
    setError("");
  }

  async function copyInviteLink() {
    if (!room) return;
    await copyWithFallback(getInviteUrl(room.code), "invite link");
    setError("");
  }

  function openDisplay() {
    if (!room) return;
    window.open(getDisplayUrl(room.code), "_blank", "noopener,noreferrer");
  }

  async function copyDisplayLink() {
    if (!room) return;
    await copyWithFallback(getDisplayUrl(room.code), "Shared Display link");
    setError("");
  }

  const currentPlayer = room?.players.find((player) => player.id === loadSession()?.playerId);

  return {
    displayCode,
    connected,
    room,
    error,
    busy,
    restoring,
    gameActionBusy,
    funnyBusy,
    funnyPrivate,
    currentPlayerId: currentPlayer?.id ?? null,
    isHost: Boolean(currentPlayer?.isHost),
    createRoom,
    joinRoom,
    leaveRoom,
    runGameAction,
    runFunnyAction,
    runLastWordAction,
    copyCode,
    copyInviteLink,
    openDisplay,
    copyDisplayLink,
  };
}

export type PartyRoomController = ReturnType<typeof usePartyRoom>;
