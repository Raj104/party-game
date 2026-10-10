import type { GameId, GameInfo } from "../types/party";

// Temporary game catalog. We can revise the rules together before building gameplay.
export const GAMES: GameInfo[] = [
  {
    id: "funny_answers",
    title: "Funny Answers",
    emoji: "💬",
    description: "Write hilarious responses and vote for your favorites.",
    instructions: [
      "Everyone will receive a funny prompt on their own device.",
      "Write a creative answer before time runs out.",
      "Read the anonymous answers and vote for your favorite.",
      "Earn points from votes across multiple rounds!",
    ],
  },
  {
    id: "drawing_telephone",
    title: "Drawing Telephone",
    emoji: "🎨",
    description: "Turn words into drawings and drawings into guesses.",
    instructions: [
      "Each player starts with a short written prompt.",
      "The next player draws that prompt without using words.",
      "Another player describes what they think the drawing shows.",
      "Reveal the whole chain and enjoy the hilarious changes!",
    ],
  },
];

export function findGame(gameId: GameId | null): GameInfo | undefined {
  return GAMES.find((game) => game.id === gameId);
}
