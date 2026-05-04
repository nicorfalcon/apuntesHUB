"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/database.types";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Pick<Profile, "display_name" | "avatar_url"> | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
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

    function handleProfileUpdate() {
      if (user) loadProfile(user.id, supabase);
      else supabase.auth.getUser().then(({ data }) => {
        if (data.user) loadProfile(data.user.id, supabase);
      });
    }
    window.addEventListener("profile-updated", handleProfileUpdate);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
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
    if (!user) {
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    async function fetchUnread() {
      try {
        const res = await fetch("/api/messages/unread-count", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (!cancelled) setUnreadCount(data.count ?? 0);
      } catch {
        // ignore
      }
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, pathname]);

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

  const navLinks = pathname === "/"
    ? []
    : [{ href: "/explorar", label: "Explorar" }];

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#071713]/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold tracking-tight text-foreground">
          apuntes<span className="text-accent-600">HUB</span>
        </Link>

        {/* Links desktop */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${isActive ? "text-accent-600 dark:text-accent-300" : "text-gray-500 hover:text-foreground dark:text-sand-300/75 dark:hover:text-sand-50"}`}
              >
                {link.label}
              </Link>
            );
          })}
          {user && (
            <Link
              href="/my-purchases"
              className={`text-sm font-medium transition-colors ${pathname.startsWith("/my-purchases") ? "text-accent-600 dark:text-accent-300" : "text-gray-500 hover:text-foreground dark:text-sand-300/75 dark:hover:text-sand-50"}`}
            >
              Mi biblioteca
            </Link>
          )}
          {user && (
            <Link
              href={`/sell/new?from=${encodeURIComponent(pathname)}`}
              className={`text-sm font-medium transition-colors ${pathname.startsWith("/sell") ? "text-accent-600 dark:text-accent-300" : "text-gray-500 hover:text-foreground dark:text-sand-300/75 dark:hover:text-sand-50"}`}
            >
              Vender
            </Link>
          )}
        </div>

        {/* Auth + hamburger */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
            <Link
              href="/mensajes"
              aria-label={
                unreadCount > 0
                  ? `Mensajes (${unreadCount} sin leer)`
                  : "Mensajes"
              }
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 dark:text-sand-200 dark:hover:bg-white/10"
            >
              <MessageCircle className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white dark:ring-[#071713]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-600 text-xs font-semibold text-white"
                aria-label="Menú de usuario"
              >
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.display_name ?? "Avatar"}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg shadow-black/5 dark:border-white/10 dark:bg-[#071713] dark:shadow-black/35">
                  <div className="border-b border-gray-100 px-3 py-2 dark:border-white/10">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-sand-50">{profile?.display_name || "Mi cuenta"}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-sand-100 dark:hover:bg-white/10"
                  >
                    Mi perfil
                  </Link>
                  <Link
                    href="/sell/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-sand-100 dark:hover:bg-white/10"
                  >
                    Panel de ventas
                  </Link>
                  <Link
                    href="/reputation"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-sand-100 dark:hover:bg-white/10"
                  >
                    Reputación
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full border-t border-gray-100 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:border-white/10 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className="rounded-lg px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-sand-100 dark:hover:bg-white/10"
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
            className="flex h-9 w-9 flex-col items-center justify-center gap-1 rounded-full border border-gray-200 bg-white/70 md:hidden dark:border-white/10 dark:bg-white/10"
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
        <div className="border-t border-gray-100 bg-white px-4 pb-4 md:hidden dark:border-white/10 dark:bg-[#071713]">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block py-2 text-sm font-medium transition-colors ${isActive ? "text-accent-600 dark:text-accent-300" : "text-gray-600 dark:text-sand-300/75"}`}
              >
                {link.label}
              </Link>
            );
          })}
          {user ? (
            <>
              <Link href="/mensajes" onClick={() => setMenuOpen(false)} className={`flex items-center justify-between py-2 text-sm font-medium ${pathname.startsWith("/mensajes") ? "text-accent-600 dark:text-accent-300" : "text-gray-600 dark:text-sand-300/75"}`}>
                <span>Mensajes</span>
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/profile" onClick={() => setMenuOpen(false)} className={`block py-2 text-sm font-medium ${pathname === "/profile" ? "text-accent-600 dark:text-accent-300" : "text-gray-600 dark:text-sand-300/75"}`}>Mi perfil</Link>
              <Link href="/my-purchases" onClick={() => setMenuOpen(false)} className={`block py-2 text-sm font-medium ${pathname.startsWith("/my-purchases") ? "text-accent-600 dark:text-accent-300" : "text-gray-600 dark:text-sand-300/75"}`}>Mi biblioteca</Link>
              <Link href="/sell/dashboard" onClick={() => setMenuOpen(false)} className={`block py-2 text-sm font-medium ${pathname === "/sell/dashboard" ? "text-accent-600 dark:text-accent-300" : "text-gray-600 dark:text-sand-300/75"}`}>Panel de ventas</Link>
              <Link href="/reputation" onClick={() => setMenuOpen(false)} className={`block py-2 text-sm font-medium ${pathname === "/reputation" ? "text-accent-600 dark:text-accent-300" : "text-gray-600 dark:text-sand-300/75"}`}>Reputación</Link>
              <Link href={`/sell/new?from=${encodeURIComponent(pathname)}`} onClick={() => setMenuOpen(false)} className={`block py-2 text-sm font-medium ${pathname.startsWith("/sell") ? "text-accent-600 dark:text-accent-300" : "text-gray-600 dark:text-sand-300/75"}`}>Vender</Link>
              <button
                onClick={() => { setMenuOpen(false); handleSignOut(); }}
                className="mt-2 w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 dark:border-red-400/30 dark:text-red-300"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="block py-2 text-sm text-gray-600 dark:text-sand-300/75"
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
