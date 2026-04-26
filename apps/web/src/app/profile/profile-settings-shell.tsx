"use client";

import { Suspense, useState } from "react";
import {
  Bell,
  CreditCard,
  FileText,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import { ProfileForm } from "./profile-form";
import { MpConnectSection } from "./mp-connect-section";
import type { Profile } from "@/lib/database.types";

type ProfileSection = "profile" | "payments" | "sales" | "security" | "notifications";

interface ProfileSettingsShellProps {
  userId: string;
  profile: Profile | null;
  hasMpConnected: boolean;
  connectedAt: string | null;
  oauthUrl: string;
}

const sections = [
  {
    id: "profile",
    label: "Mi perfil",
    description: "Datos públicos",
    icon: UserRound,
  },
  {
    id: "payments",
    label: "Pagos",
    description: "Cobros y Mercado Pago",
    icon: CreditCard,
  },
  {
    id: "sales",
    label: "Mis ventas",
    description: "Actividad de vendedor",
    icon: FileText,
  },
  {
    id: "security",
    label: "Seguridad",
    description: "Cuenta y sesión",
    icon: LockKeyhole,
  },
  {
    id: "notifications",
    label: "Notificaciones",
    description: "Avisos y novedades",
    icon: Bell,
  },
] as const;

function ComingSoonPanel({
  title,
  description,
  backendNote,
}: {
  title: string;
  description: string;
  backendNote: string;
}) {
  return (
    <section className="rounded-2xl border border-gray-200/80 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="max-w-xl">
        <p className="inline-flex rounded-full bg-accent-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-700">
          Próximamente
        </p>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
        <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-sm text-gray-500">{backendNote}</p>
        </div>
      </div>
    </section>
  );
}

export function ProfileSettingsShell({
  userId,
  profile,
  hasMpConnected,
  connectedAt,
  oauthUrl,
}: ProfileSettingsShellProps) {
  const [activeSection, setActiveSection] = useState<ProfileSection>("profile");

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
      <aside className="rounded-2xl border border-gray-200/80 bg-white p-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <nav aria-label="Secciones del perfil" className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                  isActive
                    ? "bg-accent-50 text-accent-700"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isActive ? "bg-white text-accent-600 shadow-sm" : "bg-gray-50 text-gray-400"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{section.label}</span>
                  <span className="block truncate text-xs opacity-70">{section.description}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="space-y-10">
        {activeSection === "profile" && (
          <section>
            <ProfileForm userId={userId} profile={profile} />
          </section>
        )}

        {activeSection === "payments" && (
          <section>
            <Suspense fallback={<div className="h-36 rounded-2xl border border-gray-200/80 bg-white animate-pulse" />}>
              <MpConnectSection
                hasMpConnected={hasMpConnected}
                connectedAt={connectedAt}
                oauthUrl={oauthUrl}
              />
            </Suspense>
          </section>
        )}

        {activeSection === "sales" && (
          <ComingSoonPanel
            title="Mis ventas"
            description="Acá vas a poder ver resumen de ventas, apuntes con mejor rendimiento, cobros pendientes y métricas simples de tus publicaciones."
            backendNote="Por ahora queda como sección visual: todavía no conectamos el backend de estadísticas y movimientos de venta."
          />
        )}

        {activeSection === "security" && (
          <ComingSoonPanel
            title="Seguridad"
            description="Esta sección puede agrupar datos de cuenta, sesiones activas, cambios de email y controles básicos para proteger tu perfil."
            backendNote="Por ahora queda como sección visual: todavía no implementamos el backend de seguridad de cuenta."
          />
        )}

        {activeSection === "notifications" && (
          <ComingSoonPanel
            title="Notificaciones"
            description="Acá irían avisos sobre compras, ventas, reseñas nuevas, pagos y actividad importante dentro del marketplace."
            backendNote="Por ahora queda como sección visual: todavía no tenemos backend de notificaciones."
          />
        )}
      </div>
    </div>
  );
}
