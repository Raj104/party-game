GAME SELECTION MILESTONE

1. Extract this ZIP into the party-game project root, retaining the included directories.
2. This replaces server/src/index.ts and client/src/App.tsx, and adds client/src/GameSelection.css.
3. Keep your existing App.css, index.css, socket.ts and other files.
4. Restart backend: cd server && npm run dev
5. Start frontend: cd client && npm run dev
6. Frontend build: cd client && npm run build

Game phases implemented: lobby -> selection -> instructions.
Host-only events: open_game_selection, select_game, show_game_instructions, back_to_game_selection, return_to_lobby.
No active game rounds implemented yet.
