"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error("[reset-password] updateUser failed", {
        message: error.message,
        status: error.status,
        name: error.name,
        code: (error as { code?: string }).code,
      });
      setError(`No se pudo actualizar la contraseña: ${error.message}`);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login?reset=ok");
    router.refresh();
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
                Nueva contraseña
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Ingresá tu nueva contraseña para restablecer el acceso a tu
                cuenta.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[#1a1a1a]"
                >
                  Nueva contraseña
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#d1d5db] px-4 py-2.5 pr-11 text-sm text-[#1a1a1a] outline-none transition-colors focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/20"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F]/25"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-[#1a1a1a]"
                >
                  Confirmar contraseña
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#d1d5db] px-4 py-2.5 pr-11 text-sm text-[#1a1a1a] outline-none transition-colors focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/20"
                  />
                  <button
                    type="button"
                    aria-label={
                      showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F]/25"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
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
                {loading ? "Guardando..." : "Guardar contraseña"}
              </button>
            </form>
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
