import { randomInt } from "node:crypto";

// Both words are 4–6 ASCII letters. A few thousand combinations are available.
const ADJECTIVES = [
  "brave", "brisk", "calm", "cheeky", "chill", "cosmic", "crisp", "curvy", "dizzy", "dusty",
  "eager", "fancy", "feral", "fizzy", "fresh", "funny", "fuzzy", "gentle", "giddy", "glad",
  "goofy", "grand", "grumpy", "happy", "hasty", "jazzy", "jolly", "juicy", "lanky", "lazy",
  "lively", "loopy", "lucky", "mellow", "merry", "moody", "nifty", "noisy", "oddly", "peppy",
  "plucky", "proud", "quick", "quirky", "rapid", "rowdy", "salty", "shady", "shiny", "silly",
  "sleepy", "slyly", "snappy", "snug", "solar", "spicy", "spooky", "spry", "sugary", "sunny",
  "swift", "tasty", "tidy", "tiny", "toasty", "wacky", "warm", "weird", "wild", "zesty",
] as const;
const NOUNS = [
  "alien", "apple", "bagel", "bison", "blob", "boots", "bunny", "cactus", "camel", "candy",
  "chaos", "chess", "cloud", "cobra", "comet", "crab", "crane", "crow", "curry", "donut",
  "drama", "duck", "eagle", "fairy", "ferret", "flame", "flute", "frogs", "gecko", "ghost",
  "goose", "grape", "heron", "hippo", "horse", "igloo", "joker", "koala", "lemur", "llama",
  "lotus", "mango", "melon", "moose", "moth", "nacho", "ninja", "otter", "panda", "peach",
  "pizza", "prawn", "quail", "raven", "rhino", "robot", "salad", "shark", "sheep", "skunk",
  "sloth", "snail", "snake", "socks", "spoon", "squid", "sushi", "taco", "tiger", "toast",
  "tofu", "tulip", "viper", "whale", "zebra",
] as const;

export function normalizeRoomCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  // Legacy 4-letter room codes remain valid while old rooms exist.
  if (/^[a-z]{4}$/i.test(value)) return value.toUpperCase();
  if (!/^[a-z]{4,6}-[a-z]{4,6}$/i.test(value)) return null;
  return value.toLowerCase();
}

export function generateFriendlyCode(taken: ReadonlySet<string>): string {
  const count = ADJECTIVES.length * NOUNS.length;
  // Random start + coprime step to avoid collisions without infinite retries.
  const start = randomInt(count);
  for (let i = 0; i < count; i++) {
    const index = (start + i) % count;
    const name = `${ADJECTIVES[Math.floor(index / NOUNS.length)]}-${NOUNS[index % NOUNS.length]}`;
    if (!taken.has(name)) return name;
  }
  throw new Error("No room names currently available.");
}
