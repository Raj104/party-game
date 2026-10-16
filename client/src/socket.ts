import { io } from "socket.io-client";

// In development, a phone joining through a LAN IP must connect to that same
// computer, not to the phone's own "localhost". On deployment, configure
// VITE_SERVER_URL with the publicly accessible Socket.IO backend URL.
const serverUrl = import.meta.env.VITE_SERVER_URL?.trim()
  || `${window.location.protocol}//${window.location.hostname}:3001`;

export const socket = io(serverUrl, { autoConnect: false });
