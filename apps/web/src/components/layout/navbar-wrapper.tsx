"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";

const AUTH_PATHS = ["/login", "/register"];

export function NavbarWrapper() {
  const pathname = usePathname();
  // Ocultar en páginas de auth, visor inmersivo y perfil público (tienen su propio navbar)
  if (AUTH_PATHS.includes(pathname)) return null;
  if (/^\/my-purchases\/.+\/view$/.test(pathname)) return null;
  if (/^\/profile\/.+$/.test(pathname)) return null;
  return <Navbar />;
}
