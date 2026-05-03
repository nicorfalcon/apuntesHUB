"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { SessionCard } from "@/components/sessions/session-card";
import { CLIENT_BRAND_HEADER, getClientBrand } from "@/lib/devices/client-hints";
import { useLoginDeviceIntent } from "../login-device-context";
import type { FinalizeLoginResponse } from "@/lib/database.types";

export function LoginDevicesClient() {
  const router = useRouter();
  const { intent, clearIntent } = useLoginDeviceIntent();
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!intent) router.replace("/login");
  }, [intent, router]);

  const sessions = useMemo(() => intent?.sessions ?? [], [intent]);

  async function handlePick(sessionId: string) {
    if (!intent) return;
    setLoadingSessionId(sessionId);
    setError(null);

    const brand = await getClientBrand();
    const res = await fetch("/api/auth/login/finalize", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        ...(brand ? { [CLIENT_BRAND_HEADER]: brand } : {}),
      },
      body: JSON.stringify({
        login_intent_token: intent.token,
        session_to_revoke_id: sessionId,
      }),
    });
    const data = (await res.json()) as FinalizeLoginResponse;

    if (res.ok && data.status === "ok") {
      const redirectTo = intent.redirectTo || "/browse";
      window.location.assign(redirectTo);
      return;
    }

    setError(
      data.message ??
        "No pudimos continuar con el ingreso. Volvé a iniciar sesión."
    );
    setLoadingSessionId(null);
  }

  function handleBack() {
    const redirect = intent?.redirectTo
      ? `?redirect=${encodeURIComponent(intent.redirectTo)}`
      : "";
    clearIntent();
    router.replace(`/login${redirect}`);
  }

  if (!intent) return null;

  return (
    <div className="min-h-screen bg-[#f4f7f5] px-4 py-8 text-foreground dark:bg-[#071713] sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl flex-col justify-center">
        <Link href="/" className="mb-8 text-xl font-bold tracking-tight text-foreground">
          apuntes<span className="text-accent-600 dark:text-accent-300">HUB</span>
        </Link>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_18px_50px_rgba(22,42,36,0.08)] dark:border-white/10 dark:bg-[#0f1e1a] dark:shadow-black/25 sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-600 dark:text-accent-300">
              Límite de dispositivos
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Estás conectado en otros dispositivos
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500 dark:text-sand-300/75">
              Para seguir, elegí un dispositivo para cerrar la sesión. La sesión
              recomendada es la que lleva más tiempo sin actividad.
            </p>
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-300/30 dark:bg-red-500/10 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p>{error}</p>
                <button
                  type="button"
                  onClick={handleBack}
                  className="mt-2 text-xs font-semibold underline underline-offset-4"
                >
                  Volver al login
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                variant="picker"
                isRecommended={session.id === intent.recommendedSessionId}
                isLoading={loadingSessionId === session.id}
                disabled={loadingSessionId !== null}
                onAction={() => handlePick(session.id)}
              />
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-5 text-sm dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="text-left font-medium text-gray-500 transition-colors hover:text-gray-800 dark:text-sand-300/75 dark:hover:text-sand-50"
            >
              Volver
            </button>
            <p className="text-xs text-gray-400 dark:text-sand-300/60">
              Esta opción cierra la sesión elegida en ese dispositivo.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
