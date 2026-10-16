import { useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
const STORAGE_KEY = "fff-theme";

function initialTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch { /* Local storage is not always available. */ }
  return "system";
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(initialTheme);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    function applyTheme() {
      const resolved = theme === "system" ? (preference.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    }
    applyTheme();
    preference.addEventListener?.("change", applyTheme);
    try { localStorage.setItem(STORAGE_KEY, theme); }
    catch { /* Local storage is not always available. */ }
    return () => preference.removeEventListener?.("change", applyTheme);
  }, [theme]);

  return { theme, setTheme };
}
