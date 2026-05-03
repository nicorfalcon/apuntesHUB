"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const THEME_KEY = "apunteshub-theme";
const PUBLIC_LIGHT_PATHS = new Set([
  "/",
  "/login",
  "/login/devices",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

type Theme = "light" | "dark";

function getPreferredTheme(): Theme {
  const storedTheme = window.localStorage.getItem(THEME_KEY);
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setDocumentTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeRouteGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const isPublicLightPath = PUBLIC_LIGHT_PATHS.has(pathname);

    if (isPublicLightPath) {
      setDocumentTheme("light");
      return;
    }

    setDocumentTheme(getPreferredTheme());
  }, [pathname]);

  return null;
}
