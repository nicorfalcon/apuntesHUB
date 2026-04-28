"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export function NavbarWrapper() {
  const pathname = usePathname();
  // Ocultar en páginas de auth, visor inmersivo, perfil público y flujo de venta (tienen su propio navbar)
  if (AUTH_PATHS.includes(pathname)) return null;
  if (pathname === "/") return null;
  if (/^\/my-purchases\/.+\/view$/.test(pathname)) return null;
  if (/^\/profile\/.+$/.test(pathname)) return null;
  if (pathname === "/sell/new") return null;
  if (/^\/sell\/.+\/edit$/.test(pathname)) return null;
  if (/^\/sell\/.+\/price$/.test(pathname)) return null;
  if (/^\/sell\/.+\/rename$/.test(pathname)) return null;
  if (/^\/sell\/.+\/photos$/.test(pathname)) return null;
  return <Navbar />;
}
