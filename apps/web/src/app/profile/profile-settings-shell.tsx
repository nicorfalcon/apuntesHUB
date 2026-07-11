"use client";

import { Suspense, useState } from "react";
import { Bell, CreditCard, LockKeyhole, UserRound, Cpu } from "lucide-react";

function AccessibilityNewIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="4" r="1.6" fill="currentColor" stroke="none" />
      <path d="M4 9h16" />
      <path d="M9 9v3l-2 9" />
      <path d="M15 9v3l2 9" />
    </svg>
  );
}
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ProfileForm } from "./profile-form";
import { MpConnectSection } from "./mp-connect-section";
import { SecuritySection } from "./security-section";
import { ModelosIASection } from "./modelos-ia-section";
import type { Profile } from "@/lib/database.types";
import { Skeleton } from "@/components/ui/skeleton";

type ProfileSection =
  | "profile"
  | "accessibility"
  | "ai-models"
  | "payments"
  | "security"
  | "notifications";

interface ProfileSettingsShellProps {
  userId: string;
  userEmail: string;
  hasPassword: boolean;
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
    id: "accessibility",
    label: "Accesibilidad",
    description: "Tema y lectura",
    icon: AccessibilityNewIcon,
  },
  {
    id: "ai-models",
    label: "Modelos IA",
    description: "API keys propias",
    icon: Cpu,
  },
  {
    id: "payments",
    label: "Pagos",
    description: "Cobros y Mercado Pago",
    icon: CreditCard,
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
    <section className="rounded-2xl border border-gray-200/80 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-[#0f1e1a]">
      <div className="max-w-xl">
        <p className="inline-flex rounded-full bg-accent-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-700">
          Próximamente
        </p>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-sand-300/75">{description}</p>
        <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/15 dark:bg-white/5">
          <p className="text-sm text-gray-500 dark:text-sand-300/75">{backendNote}</p>
        </div>
      </div>
    </section>
  );
}

function AccessibilityPanel() {
  return (
    <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-[#0f1e1a]">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-700 dark:text-accent-100">
          Accesibilidad
        </p>
        <h2 className="mt-3 text-xl font-bold tracking-tight text-foreground">
          Preferencias visuales
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ajustá cómo se ve apuntesHUB en este dispositivo. La preferencia queda
          guardada en tu navegador.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Modo claro u oscuro</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Cambiá el contraste general de la interfaz.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </section>
  );
}

export function ProfileSettingsShell({
  userId,
  userEmail,
  hasPassword,
  profile,
  hasMpConnected,
  connectedAt,
  oauthUrl,
}: ProfileSettingsShellProps) {
  const [activeSection, setActiveSection] = useState<ProfileSection>("profile");

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
      <aside className="rounded-2xl border border-gray-200/80 bg-white p-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-[#0f1e1a]">
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
                    ? "bg-accent-50 text-accent-700 dark:bg-accent-300/15 dark:text-accent-100"
                    : "text-gray-500 hover:bg-gray-50 dark:text-sand-300/70 dark:hover:bg-white/5 dark:hover:text-sand-50"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isActive ? "bg-white text-accent-600 shadow-sm dark:bg-accent-400/15 dark:text-accent-200" : "bg-gray-50 text-gray-400 dark:bg-white/5 dark:text-sand-300/55"
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

        {activeSection === "accessibility" && <AccessibilityPanel />}

        {activeSection === "ai-models" && <ModelosIASection />}

        {activeSection === "payments" && (
          <section>
            <Suspense fallback={<Skeleton tone="none" className="h-36 rounded-2xl border border-gray-200/80 bg-white dark:border-white/10 dark:bg-[#0f1e1a]" />}>
              <MpConnectSection
                hasMpConnected={hasMpConnected}
                connectedAt={connectedAt}
                oauthUrl={oauthUrl}
              />
            </Suspense>
          </section>
        )}

        {activeSection === "security" && (
          <SecuritySection email={userEmail} hasPassword={hasPassword} />
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
