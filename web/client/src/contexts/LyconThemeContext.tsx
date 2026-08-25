import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type LyconTheme = "dark" | "light";
type LyconThemeContextValue = { theme: LyconTheme; toggleTheme: () => void };

const LyconThemeContext = createContext<LyconThemeContextValue | null>(null);

export function LyconThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<LyconTheme>(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem("lycon-theme") === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("lycon-theme", theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark") }), [theme]);
  return <LyconThemeContext.Provider value={value}>{children}</LyconThemeContext.Provider>;
}

export function useLyconTheme() {
  const value = useContext(LyconThemeContext);
  if (!value) throw new Error("useLyconTheme must be used within LyconThemeProvider");
  return value;
}
