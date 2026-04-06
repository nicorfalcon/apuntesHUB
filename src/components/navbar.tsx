"use client";

import { useState } from "react";
import Link from "next/link";
import { usuarioMock } from "@/lib/mock-data";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logueado, setLogueado] = useState(usuarioMock.logueado);

  const links = [
    { href: "/", label: "Inicio" },
    { href: "/explorar", label: "Explorar" },
    { href: "/subir", label: "Subir apunte" },
    { href: "/perfil", label: "Mi perfil" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold tracking-tight text-foreground">
          apuntes<span className="text-accent-600">HUB</span>
        </Link>

        {/* Links desktop */}
        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-600 transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Sesión + hamburger */}
        <div className="flex items-center gap-3">
          {logueado ? (
            <button
              onClick={() => setLogueado(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-600 text-xs font-semibold text-white"
              title="Cerrar sesión"
            >
              {usuarioMock.avatar}
            </button>
          ) : (
            <button
              onClick={() => setLogueado(true)}
              className="hidden rounded-lg bg-accent-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-700 md:block"
            >
              Iniciar sesión
            </button>
          )}

          {/* Hamburger mobile */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex flex-col gap-1 md:hidden"
            aria-label="Menú"
          >
            <span
              className={`h-0.5 w-5 bg-foreground transition-transform ${menuOpen ? "translate-y-1.5 rotate-45" : ""}`}
            />
            <span
              className={`h-0.5 w-5 bg-foreground transition-opacity ${menuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`h-0.5 w-5 bg-foreground transition-transform ${menuOpen ? "-translate-y-1.5 -rotate-45" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block py-2 text-sm text-gray-600 transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          {!logueado && (
            <button
              onClick={() => {
                setLogueado(true);
                setMenuOpen(false);
              }}
              className="mt-2 w-full rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-700"
            >
              Iniciar sesión
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
