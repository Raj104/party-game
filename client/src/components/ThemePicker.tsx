import { useEffect, useRef } from "react";
import type { ThemePreference } from "../hooks/useTheme";

type Props = {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
};

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function ThemeIcon({ mode }: { mode: ThemePreference }) {
  if (mode === "system") return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  );
  if (mode === "light") return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>
    </svg>
  );
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.3 14.5A8.5 8.5 0 0 1 9.5 3.7 8.5 8.5 0 1 0 20.3 14.5Z"/>
    </svg>
  );
}

export function ThemePicker({ value, onChange }: Props) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const onOutside = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <details ref={ref} className="fff-theme-picker">
      <summary aria-label={`Appearance: ${value}`}>
        <ThemeIcon mode={value}/><span>{OPTIONS.find(option => option.value === value)?.label}</span>
        <svg aria-hidden="true" className="fff-theme-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </summary>
      <div className="fff-theme-options" role="group" aria-label="Appearance options">
        {OPTIONS.map(option => (
          <button key={option.value} type="button" aria-pressed={value === option.value}
            onClick={() => { onChange(option.value); if (ref.current) ref.current.open = false; }}>
            <ThemeIcon mode={option.value}/><span>{option.label}</span>
            {value === option.value && <span className="fff-theme-check" aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>
    </details>
  );
}
