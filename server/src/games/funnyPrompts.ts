import { randomInt } from "node:crypto";
import type { FunnyParticipant, FunnyPrompt, FunnyPromptCategory } from "../types";

/**
 * Every prompt references the real nicknames of the people playing.
 * These are local, curated templates: no AI API or internet access needed.
 * Group prompts refer to everyone collectively without listing nicknames.
 */
const TEMPLATES: Record<FunnyPromptCategory, string[]> = {
  solo: [
    "What's the first thing {player} would do after a disastrous date?",
    "Where would you find {player} after they vanish inside a supermarket?",
    "What would {player} name their secret underground club?",
    "If {player} became a superhero, what would their completely useless power be?",
    "What unusual hobby would {player} become world-famous for?",
    "What would {player} say if they accidentally became president for a day?",
    "What would be the title of {player}'s very dramatic autobiography?",
    "What would {player} bring to a deserted island that nobody else would think of?",
    "What ridiculous excuse would {player} give for arriving three hours late?",
    "What would {player} do first if they woke up as a talking cat?",
    "What would {player} invent if they were given a million dollars and no supervision?",
    "What would {player} shout while winning the world's strangest competition?",
    "Why would {player} get kicked out of a fancy restaurant?",
    "What would {player}'s secret talent be on a very chaotic talent show?",
    "If {player} owned a theme park, what would its scariest ride be?",
    "What would {player} accidentally teach an alien about Earth?",
    "What's the most unexpected thing {player} would buy during a midnight shopping spree?",
    "What would {player} say to convince everyone they're from the future?",
    "What job would {player} be hilariously bad at for their very first day?",
    "What would be {player}'s one rule for surviving a zombie apocalypse?",
  ],
  duo: [
    "What business would {player1} and {player2} start, and why would it fail spectacularly?",
    "Why would {player1} and {player2} get banned from a theme park?",
    "What would happen if {player1} and {player2} swapped lives for one day?",
    "What would {player1} and {player2} call their very questionable detective agency?",
    "What would be the title of a movie starring {player1} and {player2}?",
    "What chaotic meal would {player1} and {player2} cook on a reality show?",
    "Why would {player1} and {player2} be asked to leave a museum?",
    "What would {player1} and {player2} argue about while stranded on a desert island?",
    "What product would {player1} and {player2} invent at 3 AM?",
    "If {player1} and {player2} hosted a podcast, what would it be called?",
    "What outrageous rule would {player1} and {player2} set as roommates?",
    "What would be {player1} and {player2}'s terrible plan to become famous?",
    "If {player1} and {player2} ran a school, what would the strangest class be?",
    "What would {player1} and {player2} accidentally unleash while trying to fix a toaster?",
    "Why would {player1} and {player2} lose a cooking competition before it even started?",
    "What would {player1} and {player2} do with a spaceship they weren't supposed to borrow?",
    "What secret handshake would {player1} and {player2} invent?",
    "What would {player1} and {player2} sell at the world's least successful garage sale?",
  ],
  group: [
    "If {group} started a band, what would their first hit song be called?",
    "What would happen if {group} got locked in a supermarket overnight?",
    "If {group} opened a restaurant, what would be the weirdest menu item?",
    "What would be the worst possible team name for {group}?",
    "If {group} shared a giant mansion, what would their first house rule be?",
    "What would {group} argue about on a ten-hour road trip?",
    "If {group} entered a talent show, what would their disastrous act be?",
    "What would {group} do if they found a mysterious button labeled DO NOT PRESS?",
    "If {group} had to build a theme park, what would its main attraction be?",
    "What would {group} call their extremely unsuccessful spy organization?",
    "If {group} ran a country together, what would their first ridiculous law be?",
    "What would happen if {group} tried to plan a surprise party for themselves?",
    "Which wild invention would {group} pitch to a very confused investor?",
    "What would be the title of a reality show starring {group}?",
    "If {group} were stuck in an escape room, what would they do instead of escaping?",
    "What would {group} accidentally summon during a group cooking lesson?",
  ],
};

function shuffle<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Choose unique featured names, favoring people named least often so far. */
function featurePlayers(
  participants: FunnyParticipant[],
  count: number,
  appearances: Map<string, number>,
): FunnyParticipant[] {
  const selected: FunnyParticipant[] = [];
  const candidates = shuffle(participants);
  while (selected.length < count && candidates.length) {
    candidates.sort((a, b) => (appearances.get(a.id) ?? 0) - (appearances.get(b.id) ?? 0));
    const person = candidates.shift()!;
    selected.push(person);
    appearances.set(person.id, (appearances.get(person.id) ?? 0) + 1);
  }
  return selected;
}

/**
 * Three rounds: one prompt per category, in a shuffled order.
 * Five rounds: one each plus two different categories (balanced 2/2/1).
 * Categories, templates and selected names are shuffled anew each game.
 */
export function createFunnyPrompts(participants: FunnyParticipant[], rounds: 3 | 5): FunnyPrompt[] {
  if (participants.length < 3 || participants.length > 10) throw new Error("Hot Take needs 3–10 players.");
  const categories: FunnyPromptCategory[] = ["solo", "duo", "group"];
  if (rounds === 5) categories.push(...shuffle<FunnyPromptCategory>(["solo", "duo", "group"]).slice(0, 2));
  const appearances = new Map(participants.map((person) => [person.id, 0]));
  const available = {
    solo: shuffle(TEMPLATES.solo),
    duo: shuffle(TEMPLATES.duo),
    group: shuffle(TEMPLATES.group),
  };
  return shuffle(categories).map((category) => {
    // Solo/Duo use fair name rotation; group prompts are about everyone
    // without listing nicknames or distorting the solo/duo rotation.
    const featuredCount = category === "solo" ? 1 : category === "duo" ? 2 : 0;
    const featured = featurePlayers(participants, featuredCount, appearances);
    const names = featured.map((person) => person.name);
    const template = available[category].pop()!;
    const group = "everyone here";
    const text = template.replace(/\{player1\}|\{player2\}|\{player\}|\{group\}/g, (token) => {
      if (token === "{player}") return names[0];
      if (token === "{player1}") return names[0];
      if (token === "{player2}") return names[1];
      return group;
    });
    return { category, text, featuredPlayerIds: category === "group" ? participants.map(person => person.id) : featured.map((person) => person.id) };
  });
}
