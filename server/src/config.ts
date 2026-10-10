export const FRONTEND_URL = "http://localhost:5173";
export const PORT = Number(process.env.PORT) || 3001;
export const MAX_PLAYERS = 12;
// Keep the existing three-minute reconnect window (180 seconds).
export const RECONNECT_GRACE_MS = 180_000;
