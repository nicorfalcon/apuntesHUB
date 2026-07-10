"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { BookOpen, CalendarDays, GraduationCap, Library, MessageCircle, PenLine, ShoppingCart } from "lucide-react";
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
  const [cartCount, setCartCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    function refreshUserProfile() {
      supabase.auth.getUser().then(({ data }) => {
        setUser(data.user);
        if (data.user) loadProfile(data.user.id, supabase);
        else setProfile(null);
      });
    }

    refreshUserProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id, supabase);
      else setProfile(null);
    });

    window.addEventListener("profile-updated", refreshUserProfile);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("profile-updated", refreshUserProfile);
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
      if (document.visibilityState !== "visible") return;
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
    window.addEventListener("focus", fetchUnread);
    document.addEventListener("visibilitychange", fetchUnread);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", fetchUnread);
      document.removeEventListener("visibilitychange", fetchUnread);
    };
  }, [user, pathname]);

  useEffect(() => {
    if (!user) {
      setCartCount(0);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    async function fetchCartCount() {
      const { count } = await supabase
        .from("cart_items")
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", user!.id);
      if (!cancelled) setCartCount(count ?? 0);
    }
    fetchCartCount();
    window.addEventListener("cart-updated", fetchCartCount);
    return () => {
      cancelled = true;
      window.removeEventListener("cart-updated", fetchCartCount);
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

  const navItems = pathname === "/"
    ? []
    : [
        {
          href: "/explorar",
          label: "Explorar",
          icon: BookOpen,
          active: pathname === "/explorar",
        },
        ...(user
          ? [
              {
                href: "/my-purchases",
                label: "Mi biblioteca",
                icon: Library,
                active: pathname.startsWith("/my-purchases"),
              },
              {
                href: `/sell/new?from=${encodeURIComponent(pathname)}`,
                label: "Vender",
                icon: PenLine,
                active: pathname.startsWith("/sell"),
              },
              {
                href: "/clases",
                label: "Clases",
                icon: CalendarDays,
                active: pathname.startsWith("/clases"),
              },
            ]
          : []),
      ];
  const messagesActive = pathname.startsWith("/mensajes");

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/[0.86] backdrop-blur-xl dark:border-white/10 dark:bg-[#071713]/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          translate="no"
          className="shrink-0 rounded-lg text-xl font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35"
        >
          apuntes<span className="text-accent-600">HUB</span>
        </Link>

        {navItems.length > 0 && (
          <div className="hidden items-center gap-1 rounded-2xl border border-gray-200 bg-[var(--surface-warm)]/70 p-1 dark:border-white/10 dark:bg-white/[0.04] md:flex">
            {navItems.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={link.active ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 active:scale-[0.98] ${
                    link.active
                      ? "bg-white text-accent-700 shadow-[0_6px_18px_rgba(38,56,51,0.06)] dark:bg-accent-300/15 dark:text-accent-100 dark:shadow-none"
                      : "text-gray-600 hover:bg-white/70 hover:text-foreground dark:text-sand-300/75 dark:hover:bg-white/10 dark:hover:text-sand-50"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/carrito"
                aria-current={pathname === "/carrito" ? "page" : undefined}
                aria-label={cartCount > 0 ? `Carrito (${cartCount})` : "Carrito"}
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 active:scale-[0.98] ${
                  pathname === "/carrito"
                    ? "border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-300/30 dark:bg-accent-300/15 dark:text-accent-100"
                    : "border-transparent text-gray-600 hover:border-gray-200 hover:bg-white dark:text-sand-200 dark:hover:border-white/10 dark:hover:bg-white/10"
                }`}
              >
                <ShoppingCart className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-[#071713]">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </Link>

              <Link
                href="/mensajes"
                aria-current={messagesActive ? "page" : undefined}
                aria-label={
                  unreadCount > 0
                    ? `Mensajes (${unreadCount} sin leer)`
                    : "Mensajes"
                }
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 active:scale-[0.98] ${
                  messagesActive
                    ? "border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-300/30 dark:bg-accent-300/15 dark:text-accent-100"
                    : "border-transparent text-gray-600 hover:border-gray-200 hover:bg-white dark:text-sand-200 dark:hover:border-white/10 dark:hover:bg-white/10"
                }`}
              >
                <MessageCircle className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-[#071713]">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>

              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((v) => !v)}
                  aria-expanded={dropdownOpen}
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-accent-600 text-xs font-bold text-white ring-1 ring-accent-700/10 transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 active:scale-[0.98] dark:bg-accent-300 dark:text-[#071713]"
                  aria-label="Menú de usuario"
                >
                  {profile?.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt={profile.display_name ?? "Avatar"}
                      width={40}
                      height={40}
                      className="h-10 w-10 object-cover"
                    />
                  ) : (
                    initials
                  )}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white py-1 shadow-[0_18px_46px_rgba(38,56,51,0.12)] dark:border-white/10 dark:bg-[#071713] dark:shadow-black/35">
                    <div className="border-b border-gray-100 px-3 py-3 dark:border-white/10">
                      <p className="truncate text-sm font-bold text-gray-900 dark:text-sand-50">
                        {profile?.display_name || "Mi cuenta"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Cuenta
                      </p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/35 dark:text-sand-100 dark:hover:bg-white/10"
                    >
                      Mi perfil
                    </Link>
                    <Link
                      href="/my-purchases"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/35 dark:text-sand-100 dark:hover:bg-white/10"
                    >
                      Mi biblioteca
                    </Link>
                    <Link
                      href="/sell/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/35 dark:text-sand-100 dark:hover:bg-white/10"
                    >
                      Panel de ventas
                    </Link>
                    <Link
                      href="/profile/profesor"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/35 dark:text-sand-100 dark:hover:bg-white/10"
                    >
                      Perfil de profesor
                    </Link>
                    <Link
                      href="/reputation"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/35 dark:text-sand-100 dark:hover:bg-white/10"
                    >
                      Reputación
                    </Link>
                    <Link
                      href="/ayuda"
                      onClick={() => setDropdownOpen(false)}
                      className="block border-t border-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/35 dark:border-white/10 dark:text-sand-100 dark:hover:bg-white/10"
                    >
                      Centro de ayuda
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full border-t border-gray-100 px-3 py-2 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/30 dark:border-white/10 dark:text-red-300 dark:hover:bg-red-500/10"
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
                className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 active:scale-[0.98] dark:text-sand-100 dark:hover:bg-white/10"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 active:scale-[0.98] dark:bg-accent-300 dark:text-[#071713]"
              >
                Registrarse
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white/80 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 md:hidden dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            aria-label="Menú"
          >
            <span aria-hidden="true" className={`h-0.5 w-5 bg-foreground transition-transform ${menuOpen ? "translate-y-1.5 rotate-45" : ""}`} />
            <span aria-hidden="true" className={`h-0.5 w-5 bg-foreground transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
            <span aria-hidden="true" className={`h-0.5 w-5 bg-foreground transition-transform ${menuOpen ? "-translate-y-1.5 -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-gray-100 bg-white md:hidden dark:border-white/10 dark:bg-[#071713]">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="grid gap-1">
              {navItems.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={link.active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 ${
                      link.active
                        ? "bg-accent-50 text-accent-700 dark:bg-accent-300/15 dark:text-accent-100"
                        : "text-gray-600 hover:bg-gray-50 dark:text-sand-300/75 dark:hover:bg-white/10"
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                    {link.label}
                  </Link>
                );
              })}

              {user ? (
                <>
                  <Link
                    href="/mensajes"
                    onClick={() => setMenuOpen(false)}
                    aria-current={messagesActive ? "page" : undefined}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 ${
                      messagesActive
                        ? "bg-accent-50 text-accent-700 dark:bg-accent-300/15 dark:text-accent-100"
                        : "text-gray-600 hover:bg-gray-50 dark:text-sand-300/75 dark:hover:bg-white/10"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                      Mensajes
                    </span>
                    {unreadCount > 0 && (
                      <span className="ml-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link href="/profile" onClick={() => setMenuOpen(false)} className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 ${pathname === "/profile" ? "bg-accent-50 text-accent-700 dark:bg-accent-300/15 dark:text-accent-100" : "text-gray-600 hover:bg-gray-50 dark:text-sand-300/75 dark:hover:bg-white/10"}`}>Mi perfil</Link>
                  <Link href="/profile/profesor" onClick={() => setMenuOpen(false)} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 ${pathname === "/profile/profesor" ? "bg-accent-50 text-accent-700 dark:bg-accent-300/15 dark:text-accent-100" : "text-gray-600 hover:bg-gray-50 dark:text-sand-300/75 dark:hover:bg-white/10"}`}><GraduationCap className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />Perfil de profesor</Link>
                  <Link href="/sell/dashboard" onClick={() => setMenuOpen(false)} className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 ${pathname === "/sell/dashboard" ? "bg-accent-50 text-accent-700 dark:bg-accent-300/15 dark:text-accent-100" : "text-gray-600 hover:bg-gray-50 dark:text-sand-300/75 dark:hover:bg-white/10"}`}>Panel de ventas</Link>
                  <Link href="/reputation" onClick={() => setMenuOpen(false)} className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 ${pathname === "/reputation" ? "bg-accent-50 text-accent-700 dark:bg-accent-300/15 dark:text-accent-100" : "text-gray-600 hover:bg-gray-50 dark:text-sand-300/75 dark:hover:bg-white/10"}`}>Reputación</Link>
                  <Link href="/ayuda" onClick={() => setMenuOpen(false)} className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 ${pathname === "/ayuda" ? "bg-accent-50 text-accent-700 dark:bg-accent-300/15 dark:text-accent-100" : "text-gray-600 hover:bg-gray-50 dark:text-sand-300/75 dark:hover:bg-white/10"}`}>Centro de ayuda</Link>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); handleSignOut(); }}
                    className="mt-2 w-full rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 dark:text-sand-300/75 dark:hover:bg-white/10"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMenuOpen(false)}
                    className="mt-2 block rounded-xl bg-accent-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 dark:bg-accent-300 dark:text-[#071713]"
                  >
                    Registrarse
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
