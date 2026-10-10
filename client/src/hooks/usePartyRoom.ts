import { useEffect, useState } from "react";
import { socket } from "../socket";
import { clearSession, getDisplayCode, getDisplayUrl, loadSession, saveSession } from "../lib/session";
import type { ActionResponse, GameId, JoinResponse, Room, RoomResponse } from "../types/party";

// Socket events, connection recovery, and player actions all live here.
// Screens only receive room state and callbacks; they never own a socket.
const displayCode = getDisplayCode();

export function usePartyRoom() {
  const [connected, setConnected] = useState(socket.connected);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gameActionBusy, setGameActionBusy] = useState(false);
  const [restoring, setRestoring] = useState(Boolean(!displayCode && loadSession()));

  useEffect(() => {
    let active = true;

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

      const saved = loadSession();
      if (saved) {
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
      if (!displayCode) setRestoring(Boolean(loadSession()));
    }

    function onRoomUpdated(updatedRoom: Room) {
      if (!active) return;
      if (displayCode) {
        if (updatedRoom.code === displayCode) setRoom(updatedRoom);
      } else if (loadSession()?.code === updatedRoom.code) {
        setRoom(updatedRoom);
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
      setError("This player session was opened in another tab.");
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
    if (socket.connected) onConnect();
    else socket.connect();

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

  function createRoom(name: string) {
    if (!connected || busy || restoring) return;
    if (!name.trim()) return setError("Please enter your nickname.");
    setBusy(true);
    setError("");
    socket.emit("create_room", name.trim(), handleJoinResponse);
  }

  function joinRoom(code: string, name: string) {
    if (!connected || busy || restoring) return;
    if (!name.trim()) return setError("Please enter your nickname.");
    if (code.trim().length !== 4) return setError("Room codes must be 4 letters.");
    setBusy(true);
    setError("");
    socket.emit("join_room", code.trim().toUpperCase(), name.trim(), handleJoinResponse);
  }

  function leaveRoom() {
    socket.emit("leave_room");
    clearSession();
    setRoom(null);
    setError("");
    setRestoring(false);
  }

  function runGameAction(event: string, gameId?: GameId) {
    if (!socket.connected || gameActionBusy) return;
    setGameActionBusy(true);
    setError("");
    const onResponse = (response: ActionResponse) => {
      setGameActionBusy(false);
      if (!response.ok) setError(response.error);
    };
    if (gameId) socket.emit(event, gameId, onResponse);
    else socket.emit(event, onResponse);
  }

  async function copyCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
    } catch {
      setError("Couldn't copy the room code.");
    }
  }

  function openDisplay() {
    if (!room) return;
    window.open(getDisplayUrl(room.code), "_blank", "noopener,noreferrer");
  }

  async function copyDisplayLink() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(getDisplayUrl(room.code));
    } catch {
      setError("Couldn't copy the Shared Display link.");
    }
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
    isHost: Boolean(currentPlayer?.isHost),
    createRoom,
    joinRoom,
    leaveRoom,
    runGameAction,
    copyCode,
    openDisplay,
    copyDisplayLink,
  };
}

export type PartyRoomController = ReturnType<typeof usePartyRoom>;
