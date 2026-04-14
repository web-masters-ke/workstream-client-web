"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";
const KEY = "ws-client-theme";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && (localStorage.getItem(KEY) as Theme | null)) || null;
    const prefersDark =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const initial: Theme = saved ?? (prefersDark ? "dark" : "light");
    applyTheme(initial);
    setThemeState(initial);
  }, []);

  const applyTheme = (t: Theme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  };

  const setTheme = (t: Theme) => {
    applyTheme(t);
    setThemeState(t);
    if (typeof window !== "undefined") localStorage.setItem(KEY, t);
  };

  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");

  return <Ctx.Provider value={{ theme, toggle, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside ThemeProvider");
  return v;
}
