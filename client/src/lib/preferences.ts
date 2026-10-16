export type CharacterId = "scribble" | "bolt" | "odd-one" | "stripe" | "orbit" | "blob";

export const CHARACTERS: { id: CharacterId; label: string }[] = [
  { id: "scribble", label: "The Scribble" },
  { id: "bolt", label: "The Bolt" },
  { id: "odd-one", label: "The Odd One" },
  { id: "stripe", label: "The Stripe" },
  { id: "orbit", label: "The Orbit" },
  { id: "blob", label: "The Blob" },
];

const NICKNAME_KEY = "fff-nickname";
const CHARACTER_KEY = "fff-character";

export function getStoredNickname() {
  try { return localStorage.getItem(NICKNAME_KEY) ?? ""; }
  catch { return ""; }
}

export function saveNickname(nickname: string) {
  try { localStorage.setItem(NICKNAME_KEY, nickname); }
  catch { /* Storage can be unavailable. */ }
}

export function getStoredCharacter(): CharacterId {
  try {
    const stored = localStorage.getItem(CHARACTER_KEY);
    const matched = CHARACTERS.find((item) => item.id === stored);
    return matched?.id ?? "scribble";
  } catch { return "scribble"; }
}

export function saveCharacter(character: CharacterId) {
  try { localStorage.setItem(CHARACTER_KEY, character); }
  catch { /* Storage can be unavailable. */ }
}
