"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/database.types";

export function Navbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Pick<Profile, "display_name" | "avatar_url"> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) loadProfile(data.user.id, supabase);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id, supabase);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string, supabase: ReturnType<typeof createClient>) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", userId)
      .single();
    if (data) setProfile(data);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setDropdownOpen(false);
    router.push("/");
    router.refresh();
  }

  const initials = profile?.display_name
    ? profile.display_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const navLinks = [
    { href: "/", label: "Inicio" },
    { href: "/browse", label: "Explorar" },
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
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-600 transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          {user && (
            <Link
              href="/sell/new"
              className="text-sm text-gray-600 transition-colors hover:text-foreground"
            >
              Subir apunte
            </Link>
          )}
        </div>

        {/* Auth + hamburger */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-600 text-xs font-semibold text-white"
                aria-label="Menú de usuario"
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                  <div className="border-b border-gray-100 px-3 py-2">
                    <p className="truncate text-sm font-medium">{profile?.display_name || "Mi cuenta"}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Mi perfil
                  </Link>
                  <Link
                    href="/my-purchases"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Mis compras
                  </Link>
                  <Link
                    href="/sell/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Panel de ventas
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full border-t border-gray-100 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className="rounded-lg px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-accent-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-700"
              >
                Registrarse
              </Link>
            </div>
          )}

          {/* Hamburger mobile */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex flex-col gap-1 md:hidden"
            aria-label="Menú"
          >
            <span className={`h-0.5 w-5 bg-foreground transition-transform ${menuOpen ? "translate-y-1.5 rotate-45" : ""}`} />
            <span className={`h-0.5 w-5 bg-foreground transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`h-0.5 w-5 bg-foreground transition-transform ${menuOpen ? "-translate-y-1.5 -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block py-2 text-sm text-gray-600 transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/profile" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">Mi perfil</Link>
              <Link href="/my-purchases" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">Mis compras</Link>
              <Link href="/sell/dashboard" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">Panel de ventas</Link>
              <Link href="/sell/new" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">Subir apunte</Link>
              <button
                onClick={() => { setMenuOpen(false); handleSignOut(); }}
                className="mt-2 w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="block py-2 text-sm text-gray-600"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                onClick={() => setMenuOpen(false)}
                className="mt-2 block w-full rounded-lg bg-accent-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-accent-700"
              >
                Registrarse
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
