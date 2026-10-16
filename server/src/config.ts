export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
export const PORT = Number(process.env.PORT) || 3001;
export const MAX_PLAYERS = 12;
// Allow unexpected disconnections to recover for three minutes.
export const RECONNECT_GRACE_MS = 180_000;
export const EMPTY_ROOM_IDLE_MS = RECONNECT_GRACE_MS;
