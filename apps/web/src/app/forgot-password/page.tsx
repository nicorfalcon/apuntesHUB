"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?redirect=/reset-password`,
    });

    if (error) {
      if (error.message.includes("rate limit")) {
        setError("Enviaste demasiadas solicitudes. Esperá unos minutos antes de intentar de nuevo.");
      } else {
        setError("No se pudo enviar el email. Intentá de nuevo.");
      }
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen">
      <div className="relative flex w-full flex-col bg-white px-6 lg:w-1/2">
        <div className="flex shrink-0 items-center py-6 pl-2">
          <Link href="/" className="text-xl font-bold text-[#1a1a1a]">
            apuntes<span className="text-[#2D6A4F]">HUB</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">
                Recuperá tu contraseña
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Ingresá tu email y te enviaremos un enlace para restablecer tu
                contraseña.
              </p>
            </div>

            {sent ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  Te enviamos un email con un enlace para restablecer tu
                  contraseña. Revisá tu bandeja de entrada.
                </div>
                <Link
                  href="/login"
                  className="block text-center text-sm font-medium text-[#2D6A4F] hover:text-[#40916C] hover:underline"
                >
                  Volver a iniciar sesión
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-[#1a1a1a]"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#d1d5db] px-4 py-2.5 text-sm text-[#1a1a1a] outline-none transition-colors focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/20"
                  />
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#2D6A4F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#40916C] disabled:opacity-60"
                >
                  {loading ? "Enviando..." : "Enviar enlace"}
                </button>

                <Link
                  href="/login"
                  className="block text-center text-sm font-medium text-[#2D6A4F] hover:text-[#40916C] hover:underline"
                >
                  Volver a iniciar sesión
                </Link>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="relative hidden lg:block lg:w-1/2">
        <img
          src="/images/login-photo.jpg"
          alt="Estudiantes colaborando"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#2D6A4F]/70" />
        <div className="absolute inset-0 flex flex-col justify-end p-12">
          <h2 className="text-3xl font-bold text-white">
            Compartí y descubrí apuntes
          </h2>
          <p className="mt-3 max-w-md text-lg text-white/90">
            La comunidad universitaria que te ayuda a estudiar mejor
          </p>
        </div>
      </div>
    </div>
  );
}
