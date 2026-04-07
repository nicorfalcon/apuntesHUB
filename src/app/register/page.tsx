"use client";

import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-2xl font-bold tracking-tight text-foreground">
          Creá tu cuenta
        </h1>
        <p className="mt-2 text-center text-sm text-gray-500">
          Empezá a comprar y vender apuntes hoy.
        </p>

        <form className="mt-8 space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label className="block text-sm font-medium text-foreground">Nombre completo</label>
            <input
              type="text"
              placeholder="Juan Pérez"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              placeholder="juan@universidad.edu.ar"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-accent-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
          >
            Crear cuenta
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          ¿Ya tenés cuenta?{" "}
          <Link href="/" className="font-medium text-accent-600 hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
