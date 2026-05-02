"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const THEME_KEY = "apunteshub-theme";

type Theme = "light" | "dark";

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const storedTheme = window.localStorage.getItem(THEME_KEY);
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const isDark = theme === "dark";

  useEffect(() => {
    const preferredTheme = getPreferredTheme();
    setTheme(preferredTheme);
    applyTheme(preferredTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_KEY, nextTheme);
      applyTheme(nextTheme);
      window.dispatchEvent(new CustomEvent("theme-updated", { detail: nextTheme }));
      return nextTheme;
    });
  }, []);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-pressed={isDark}
      title={isDark ? "Modo oscuro" : "Modo claro"}
      className="group relative inline-flex h-9 w-[68px] shrink-0 items-center rounded-full border border-gray-200 bg-white/85 p-1 text-foreground shadow-sm backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300 hover:border-accent-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:border-accent-300/50"
    >
      <span
        className="absolute left-1 top-1 flex h-7 w-7 translate-x-0 items-center justify-center rounded-full bg-accent-600 text-white shadow-sm transition-transform duration-300 ease-out dark:translate-x-[32px]"
        aria-hidden="true"
      >
        <Sun className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45 dark:hidden" strokeWidth={2.2} />
        <Moon className="hidden h-4 w-4 transition-transform duration-300 group-hover:-rotate-12 dark:block" strokeWidth={2.2} />
      </span>
      <span className="flex w-full items-center justify-between px-1.5 text-gray-400 dark:text-white/45" aria-hidden="true">
        <Sun className="h-3.5 w-3.5" strokeWidth={2} />
        <Moon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    </button>
  );
}
