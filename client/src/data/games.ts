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
    description: "Answer personalized questions about your friends and vote for the funniest.",
    instructions: [
      "Every round, you'll see a question inspired by someone in your party.",
      "Write a funny answer before time runs out. You can edit until submissions close.",
      "Read everyone's anonymous answers, then vote for your favorite. You can't vote for yourself.",
      "Each vote is worth one point. Whoever has the most points at the end wins.",
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
