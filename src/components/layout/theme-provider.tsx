"use client";

// src/components/layout/theme-provider.tsx
// Manages dark/light mode: reads preference from /api/users/me, applies `dark`
// class to <html>, persists toggle via PATCH /api/users/me.

import { createContext, useContext, useEffect, useState, useCallback } from "react";

interface ThemeContextValue {
  dark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ dark: false, toggle: () => undefined });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  // On mount: fetch user's saved preference
  useEffect(() => {
    void fetch("/api/users/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user?: { darkMode?: boolean } } | null) => {
        const pref = data?.user?.darkMode ?? false;
        setDark(pref);
        applyClass(pref);
      });
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      applyClass(next);
      void fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ darkMode: next }),
      });
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

function applyClass(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
