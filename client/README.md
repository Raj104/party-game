# FFF client

React + TypeScript + Vite frontend. See the project root `README.md` for setup,
`STYLE_GUIDE.md` for CSS organization, and `REFACTOR_NOTES.md` for changes.

Run `npm ci`, then `npm run dev` for development or `npm run build` to produce
`dist/`. The backend Socket.IO URL is configured via `VITE_SERVER_URL` at build
time. The local development default is `http://localhost:3001` or the same LAN
hostname on port 3001.
