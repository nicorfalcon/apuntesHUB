"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    university: "",
    career: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.name,
          university: form.university,
          career: form.career,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-100">
            <svg className="h-6 w-6 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">¡Cuenta creada!</h2>
          <p className="text-sm text-gray-500">
            Revisá tu email para confirmar tu cuenta. Después podés iniciar sesión.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
          >
            Ir al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Creá tu cuenta</h1>
          <p className="mt-1 text-sm text-gray-500">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="text-accent-600 hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nombre completo
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Juan Pérez"
              value={form.name}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="juan@universidad.edu.ar"
              value={form.email}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
            />
          </div>

          <div>
            <label htmlFor="university" className="block text-sm font-medium text-gray-700">
              Universidad
            </label>
            <input
              id="university"
              name="university"
              type="text"
              placeholder="UBA, UTN, UNC..."
              value={form.university}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
            />
          </div>

          <div>
            <label htmlFor="career" className="block text-sm font-medium text-gray-700">
              Carrera
            </label>
            <input
              id="career"
              name="career"
              type="text"
              placeholder="Ingeniería, Derecho, Medicina..."
              value={form.career}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-60"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}
