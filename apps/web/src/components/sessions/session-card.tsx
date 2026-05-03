"use client";

import { Laptop, Monitor, Smartphone, Tablet, X } from "lucide-react";
import { formatRelative } from "@/lib/utils/format-relative";
import type { ActiveSession } from "@/lib/database.types";

interface SessionCardProps {
  session: ActiveSession;
  variant: "profile" | "picker";
  isRecommended?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  onAction?: () => void;
}

function DeviceIcon({ session }: { session: ActiveSession }) {
  const text = `${session.user_agent ?? ""} ${session.label ?? ""}`.toLowerCase();
  const Icon = /ipad|tablet/.test(text)
    ? Tablet
    : /iphone|android|mobile/.test(text)
    ? Smartphone
    : /macintosh|windows|linux|chrome|firefox|safari|edge|brave/.test(text)
    ? Laptop
    : Monitor;

  return <Icon className="h-5 w-5" strokeWidth={1.8} />;
}

function Content({
  session,
  isRecommended,
}: {
  session: ActiveSession;
  isRecommended?: boolean;
}) {
  return (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700 dark:bg-accent-300/15 dark:text-accent-200">
        <DeviceIcon session={session} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {session.label ?? "Dispositivo desconocido"}
          </span>
          {session.is_current && (
            <span className="inline-flex rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-700 ring-1 ring-inset ring-accent-200/60 dark:bg-accent-300/15 dark:text-accent-200 dark:ring-accent-300/25">
              Este dispositivo
            </span>
          )}
          {isRecommended && (
            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200/70 dark:bg-amber-300/10 dark:text-amber-100 dark:ring-amber-300/25">
              Recomendado · más inactivo
            </span>
          )}
        </span>
        <span className="mt-1 block text-xs text-gray-400 dark:text-sand-300/60">
          Última actividad {formatRelative(session.last_seen_at)}
        </span>
      </span>
    </>
  );
}

export function SessionCard({
  session,
  variant,
  isRecommended = false,
  isLoading = false,
  disabled = false,
  onAction,
}: SessionCardProps) {
  const baseClass =
    "group flex w-full items-center gap-3 rounded-xl border border-gray-200/80 bg-gray-50/50 px-4 py-3 text-left transition-colors dark:border-white/10 dark:bg-white/5";

  if (variant === "picker") {
    return (
      <button
        type="button"
        onClick={onAction}
        disabled={disabled || isLoading}
        className={`${baseClass} hover:border-accent-300 hover:bg-accent-50/70 disabled:cursor-wait disabled:opacity-70 dark:hover:border-accent-300/35 dark:hover:bg-accent-300/10`}
      >
        <Content session={session} isRecommended={isRecommended} />
        <span className="shrink-0 rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white transition-colors group-hover:bg-accent-700 dark:bg-accent-500 dark:text-[#071713]">
          {isLoading ? "Cerrando..." : "Cerrar y continuar"}
        </span>
      </button>
    );
  }

  return (
    <div className={baseClass}>
      <Content session={session} />
      <button
        type="button"
        onClick={onAction}
        disabled={disabled || isLoading || session.is_current}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:bg-white disabled:hover:text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-sand-100 dark:hover:border-red-300/35 dark:hover:bg-red-500/10 dark:hover:text-red-200 dark:disabled:hover:border-white/10 dark:disabled:hover:bg-white/5 dark:disabled:hover:text-sand-100"
      >
        <X className="h-3.5 w-3.5" />
        {isLoading ? "Revocando..." : "Revocar"}
      </button>
    </div>
  );
}
