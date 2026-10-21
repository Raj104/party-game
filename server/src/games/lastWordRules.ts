/** Rules shared by prompt selection and authoritative word validation. */
export type LastWordDifficulty = 1 | 2 | 3 | 4;

export const BOMB_RANGES_SECONDS: Record<number, readonly [number, number]> = {
  6: [20, 35], 5: [18, 32], 4: [16, 28], 3: [14, 24], 2: [12, 20],
};
export const TURN_MS = 10_000;
export const HANDOFF_PROTECTION_MS = 1_000;
export const PASS_EXTENSION_MS = 3_000;

export function normalizeWord(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 80) return null;
  const word = raw.normalize('NFKC').trim().toLowerCase();
  return /^[a-z]{4,40}$/.test(word) ? word : null;
}

export function matchesPrompt(word: string, prompt: string, level: LastWordDifficulty): boolean {
  if (level === 1) {
    const rest = [...word];
    return [...prompt].every(letter => {
      const index = rest.indexOf(letter);
      if (index < 0) return false;
      rest.splice(index, 1);
      return true;
    });
  }
  if (level === 2) {
    let next = 0;
    for (const letter of word) if (letter === prompt[next]) next += 1;
    return next === prompt.length;
  }
  if (level === 3) return word.includes(prompt);
  return word.startsWith(prompt) || word.endsWith(prompt);
}

export function difficultyFor(starting: number, alive: number): LastWordDifficulty {
  if (starting === 6) return alive >= 5 ? 1 : alive === 4 ? 2 : alive === 3 ? 3 : 4;
  if (starting === 5) return alive === 5 ? 1 : alive === 4 ? 2 : alive === 3 ? 3 : 4;
  if (starting === 4) return alive === 4 ? 1 : alive === 3 ? 2 : 4;
  // Three-player matches skip Level 2 and Level 4.
  return alive === 3 ? 1 : 3;
}

/** Precompute 2-letter prompt answer pools for all four levels. */
export class LastWordDictionary {
  readonly words: ReadonlySet<string>;
  private pools: Record<LastWordDifficulty, Map<string, readonly string[]>>;
  constructor(input: Iterable<string>) {
    this.words = new Set([...input].map(w => normalizeWord(w)).filter((w): w is string => Boolean(w)));
    this.pools = { 1: new Map(), 2: new Map(), 3: new Map(), 4: new Map() };
    for (let first = 97; first <= 122; first++) {
      for (let second = 97; second <= 122; second++) {
        const prompt = String.fromCharCode(first, second);
        for (const level of [1, 2, 3, 4] as const) {
          const answers = [...this.words].filter(word => matchesPrompt(word, prompt, level));
          if (answers.length) this.pools[level].set(prompt, answers);
        }
      }
    }
  }

  has(word: string) { return this.words.has(word); }

  /** Does not discard exhausted prompts until every eligible prompt was considered. */
  select(level: LastWordDifficulty, used: ReadonlySet<string>, random: (max: number) => number): string | null {
    let highestCount = 0;
    const preferred: string[] = [];
    const fallback: string[] = [];
    for (const [prompt, answers] of this.pools[level]) {
      const available = answers.reduce((count, word) => count + Number(!used.has(word)), 0);
      if (available >= 10) preferred.push(prompt);
      else if (available > 0) {
        if (available > highestCount) {
          highestCount = available;
          fallback.length = 0;
        }
        if (available === highestCount) fallback.push(prompt);
      }
    }
    const candidates = preferred.length ? preferred : fallback;
    return candidates.length ? candidates[random(candidates.length)] : null;
  }
}
