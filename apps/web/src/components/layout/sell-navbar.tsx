"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/database.types";

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 5 5 12 12 19" />
    </svg>
  );
}

// Mapeo de rutas a nombres legibles
const PATH_LABELS: Record<string, string> = {
  "/":               "Inicio",
  "/explorar":       "Explorar",
  "/my-purchases":   "Mi biblioteca",
  "/sell/dashboard": "Panel de ventas",
  "/reputation":     "Reputación",
  "/profile":        "Mi perfil",
};

function getBackInfo(fromParam: string | null, propLabel?: string, propHref?: string) {
  // Props explícitos tienen prioridad (ej: página de editar siempre vuelve al dashboard)
  if (propLabel && propHref) return { label: propLabel, href: propHref };

  if (fromParam) {
    const label = PATH_LABELS[fromParam] ?? "Volver";
    return { label, href: fromParam };
  }

  return { label: "Inicio", href: "/" };
}

interface SellNavbarProps {
  /** Override manual del destino de vuelta (ej: editar apunte → siempre al dashboard) */
  backLabel?: string;
  backHref?: string;
}

export function SellNavbar({ backLabel: propLabel, backHref: propHref }: SellNavbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");

  const { label: backLabel, href: backHref } = getBackInfo(fromParam, propLabel, propHref);

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
    <nav className="sticky top-0 z-50 shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#101816]/85">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        {/* Izquierda: logo + separador + volver */}
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
            apuntes<span className="text-accent-600">HUB</span>
          </Link>
          <div className="h-5 w-px bg-gray-200 dark:bg-white/10" />
          <Link
            href={backHref}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 dark:text-sand-300/75 dark:hover:bg-white/10 dark:hover:text-sand-50 dark:focus-visible:ring-accent-300/30"
          >
            <ArrowLeftIcon />
            {backLabel}
          </Link>
        </div>

        {/* Derecha: avatar + dropdown */}
        <div className="flex items-center gap-3">
          {user && (
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
                  <div className="border-b border-gray-100 px-3 py-2 dark:border-white/10">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-sand-50">
                      {profile?.display_name || "Mi cuenta"}
                    </p>
                  </div>
                  <Link href="/profile" onClick={() => setDropdownOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-sand-100 dark:hover:bg-white/10">Mi perfil</Link>
                  <Link href="/my-purchases" onClick={() => setDropdownOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-sand-100 dark:hover:bg-white/10">Mi biblioteca</Link>
                  <Link href="/sell/dashboard" onClick={() => setDropdownOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-sand-100 dark:hover:bg-white/10">Panel de ventas</Link>
                  <Link href="/reputation" onClick={() => setDropdownOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-sand-100 dark:hover:bg-white/10">Reputación</Link>
                  <button onClick={handleSignOut} className="w-full border-t border-gray-100 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:border-white/10 dark:text-red-300 dark:hover:bg-red-500/10">
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
