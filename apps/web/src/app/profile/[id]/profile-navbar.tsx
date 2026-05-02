"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/database.types";

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <line x1="12" y1="5" x2="5" y2="12" />
      <line x1="12" y1="19" x2="5" y2="12" />
    </svg>
  );
}

export function ProfileNavbar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Pick<Profile, "display_name" | "avatar_url"> | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) loadProfile(data.user.id, supabase);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
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

  return (
    <nav className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white/80 px-6 backdrop-blur-md dark:border-white/10 dark:bg-[#101816]/85">
      {/* Izquierda: logo + separador + back link */}
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
          apuntes<span className="text-accent-600">HUB</span>
        </Link>
        <div className="h-5 w-px bg-gray-200" />
        <Link
          href="/browse"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-foreground"
        >
          <ArrowLeftIcon />
          Explorar
        </Link>
      </div>

      {/* Derecha: tema + cuenta */}
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <ThemeToggle />

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-accent-600 text-xs font-semibold text-white"
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
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-100 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#101816]">
                <div className="border-b border-gray-100 px-3 py-2">
                  <p className="truncate text-sm font-medium">{profile?.display_name || "Mi cuenta"}</p>
                </div>
                <Link href="/profile" onClick={() => setDropdownOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Mi perfil</Link>
                <Link href="/my-purchases" onClick={() => setDropdownOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Mis apuntes</Link>
                <Link href="/sell/dashboard" onClick={() => setDropdownOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Panel de ventas</Link>
                <button onClick={handleSignOut} className="w-full border-t border-gray-100 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
          </>
        ) : (
          <div className="ml-2 hidden items-center gap-2 md:flex">
            <Link href="/login" className="rounded-lg px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100">
              Iniciar sesión
            </Link>
            <Link href="/register" className="rounded-lg bg-accent-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-700">
              Registrarse
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
