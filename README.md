# FFF – Modularization milestone

This ZIP contains **source-code changes only**. It was based on the working Game Selection ZIP from the preceding milestone, plus the older supplied lobby files. No new gameplay rules have been implemented.

## Install

1. Make sure you have saved your current Git commit.
2. Stop both dev servers (`Ctrl+C` in each terminal).
3. Extract this ZIP into the **root `party-game` folder**, preserving its `client/src` and `server/src` paths.
4. Replace the existing `client/src/App.tsx` and `server/src/index.ts` when prompted. All the other `.tsx`/`.ts` files are new.
5. Do **not** delete your existing `App.css`, `index.css`, `socket.ts`, `main.tsx`, `package.json`, `tsconfig*`, or other assets. This ZIP leaves them untouched.
6. Existing `GameSelection.css` is included unchanged.
7. From `client/`, run `npm run build`. Start both dev servers as before and test.

## Where to change things

- `client/src/App.tsx`: tiny entry point deciding between phone and TV screens
- `client/src/screens/`: joining, room/lobby, and TV screens
- `client/src/components/`: reusable player list, game cards, game-phase panel, header
- `client/src/hooks/usePartyRoom.ts`: all browser Socket.IO connections, commands, reconnects
- `client/src/types/party.ts`: public network data types
- `client/src/data/games.ts`: temporary game list and instructions
- `client/src/lib/session.ts`: sessionStorage and TV URLs
- `server/src/index.ts`: Express/Socket.IO setup only
- `server/src/rooms/store.ts`: room/player state, disconnect handling, uniqueness
- `server/src/sockets/registerRoomEvents.ts`: room events
- `server/src/sockets/registerGameEvents.ts`: host-only game selection events
- `server/src/types.ts`: internal server types
- `server/src/config.ts`: constants

## Regression tests

- Create/join room (reject duplicate nicknames)
- Leave room/host transfer
- Refresh/reconnect players and TV mode
- Choose both mini-games; show instructions; back to selection and lobby
- Non-host cannot operate host controls
- Confirm display count and offline labels

*Note:* Restarting the backend resets active rooms because state is still in memory.
