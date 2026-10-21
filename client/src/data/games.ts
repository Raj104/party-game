import type { GameId, GameInfo } from "../types/party";

// A local discovery catalog. Only available games can be chosen by the host.
// Coming-soon entries must NOT be sent to the backend's select_game event.
// Each ID has a fixed card/detail accent in styles/lobby/game-browser.css.
export const GAMES: GameInfo[] = [
  {
    id: "funny_answers",
    title: "Hot Take",
    emoji: "💬",
    glyph: "✳",
    available: true,
    playerRange: "3–10 players",
    description: "Friendships are tested. Laughs are guaranteed. The funniest answer wins.",
    instructions: [
      "Every round, you'll see a question inspired by someone in your party.",
      "Write a funny answer before time runs out. You can edit until submissions close.",
      "Read everyone's anonymous answers, then vote for your favorite. You can't vote for yourself.",
      "Each vote is worth one point. Whoever has the most points at the end wins.",
    ],
  },
  {
    id: "last_word",
    title: "Last Word",
    emoji: "",
    glyph: "✹",
    available: true,
    playerRange: "3–6 players",
    description: "Think fast. Spell faster. There's a bomb on your back.",
    instructions: [
      "Use the given prompt to make a 4+ letter English word.",
      "Submit a valid word before your turn timer runs out to pass Bomb Buddy.",
      "If the timer runs out, BOOM! Lose one full heart.",
      "Lose all 3 hearts and you're out.",
      "Earn the highest total score, including bonus points, to become champion.",
    ],
  },
  {
    id: "drawing_telephone",
    title: "Drawing Telephone",
    emoji: "🎨",
    glyph: "〰",
    available: false,
    playerRange: "Coming soon",
    description: "Turn words into drawings and drawings into guesses.",
    instructions: [
      "Everyone writes a short phrase to start a chain.",
      "The next player draws the phrase, without seeing its original wording.",
      "Another player describes that drawing in words.",
      "Reveal the full chain and see how far the idea wandered.",
    ],
  },
  {
    id: "meme_battle",
    title: "Meme Battle",
    emoji: "🃏",
    glyph: "▧",
    available: false,
    playerRange: "Coming soon",
    description: "Pick the best reaction card for a ridiculous situation.",
    instructions: [
      "Read the situation shown to the whole group.",
      "Choose your funniest meme card from a private hand.",
      "Everyone votes on the anonymous cards.",
      "Collect votes and cause extremely unnecessary arguments.",
    ],
  },
  {
    id: "mafia",
    title: "Mafia",
    emoji: "🕵️",
    glyph: "◉",
    available: false,
    playerRange: "Coming soon",
    description: "Keep your story straight. Trust nobody.",
    instructions: [
      "Each player receives a secret role.",
      "Talk, bluff, and try to figure out who's hiding something.",
      "Vote together on who you suspect.",
      "The surviving side wins the game.",
    ],
  },
  {
    id: "codenames",
    title: "Codenames",
    emoji: "🧩",
    glyph: "⌗",
    available: false,
    playerRange: "Coming soon",
    description: "One-word clues. A spectacular amount of overthinking.",
    instructions: [
      "Split into two teams and choose a clue giver.",
      "Give one-word clues to help teammates find their words.",
      "Discuss each guess carefully—or don't.",
      "Find your team's words before your opponents do.",
    ],
  },
  {
    id: "dumb_charades",
    title: "Dumb Charades",
    emoji: "🎭",
    glyph: "✺",
    available: false,
    playerRange: "Coming soon",
    description: "No talking. Just increasingly desperate acting.",
    instructions: [
      "One player receives a secret phrase.",
      "Act it out without speaking.",
      "Your team guesses before the timer runs out.",
      "Take turns until everyone has embarrassed themselves equally.",
    ],
  },
];

export function findGame(gameId: GameId | null): GameInfo | undefined {
  return GAMES.find(game => game.id === gameId);
}

// Reusable eight-color cycle for current and future game cards.
export const GAME_ACCENTS = [
  "#d48c7c", // coral
  "#b7a2d3", // lilac
  "#a8cfa7", // sage
  "#e0bd65", // mustard
  "#97bbd3", // sky
  "#d9a2bf", // rose
  "#dba580", // peach
  "#91c9c0", // teal
] as const;
export function gameAccent(gameId: GameId): string {
  const index = GAMES.findIndex(game => game.id === gameId);
  return GAME_ACCENTS[(index < 0 ? 0 : index) % GAME_ACCENTS.length];
}
