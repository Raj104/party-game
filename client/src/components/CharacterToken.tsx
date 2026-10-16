import type { CharacterId } from "../lib/preferences";

type Props = {
  character: CharacterId;
  size?: "small" | "large";
};

// Original, geometric little weirdos rather than character portraits.
// Visual-only in this frontend milestone; the server does not store avatar choices yet.
export function CharacterToken({ character, size = "small" }: Props) {
  return (
    <span className={`character-token character-token--${character} character-token--${size}`} aria-hidden="true">
      <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        {character === "scribble" && <>
          <path d="M17 38C6 29 18 14 30 14c15 0 22 17 12 29-11 12-28 0-22-14 6-13 22-6 15 4" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
          <path d="m12 48 6-3m28-32 5-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </>}
        {character === "bolt" && <>
          <path d="m33 6-21 27h17l-2 21 23-30H33z" fill="currentColor" stroke="#222" strokeWidth="2.1" strokeLinejoin="round"/>
          <path d="m17 9-4-4M8 21l-6-1m47 29 6 5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/>
        </>}
        {character === "odd-one" && <>
          <path d="M14 25 9 13l15 3 12-11 5 16 11 6-8 18-20 8-14-11z" fill="currentColor" stroke="#232323" strokeWidth="2.1" strokeLinejoin="round" />
          <path d="M19 31h1m17-4h1" stroke="#232323" strokeWidth="5" strokeLinecap="round"/>
          <path d="m25 40 6-2" stroke="#232323" strokeWidth="2.2" strokeLinecap="round"/>
        </>}
        {character === "stripe" && <>
          <path d="M20 6c19-4 28 11 24 26-2 15-12 23-26 17C6 42 10 12 20 6z" fill="currentColor" stroke="#232323" strokeWidth="2.1" />
          <path d="m12 21 30-10M11 33l33-12M17 46l27-16" stroke="#232323" strokeWidth="4.6" strokeLinecap="round" />
          <path d="M25 9 23 5" stroke="currentColor" strokeWidth="2"/>
        </>}
        {character === "orbit" && <>
          <circle cx="30" cy="30" r="13" fill="currentColor" stroke="#232323" strokeWidth="2" />
          <ellipse cx="30" cy="30" rx="26" ry="10" transform="rotate(-32 30 30)" stroke="currentColor" strokeWidth="4" />
          <circle cx="47" cy="19" r="4" fill="#232323" />
        </>}
        {character === "blob" && <>
          <path d="M14 17Q18 6 30 11T49 25q8 24-15 26Q4 57 10 35q-4-12 4-18Z" fill="currentColor" stroke="#232323" strokeWidth="2.2" />
          <path d="M22 29v3m17-5v3" stroke="#232323" strokeWidth="4" strokeLinecap="round" />
          <path d="M25 41q7-5 12-2" stroke="#232323" strokeWidth="2.5" strokeLinecap="round" />
        </>}
      </svg>
    </span>
  );
}
