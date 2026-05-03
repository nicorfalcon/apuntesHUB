"use client";

import Link from "next/link";

export default function ResumeError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-lg font-semibold text-foreground">No pudimos cargar este apunte</p>
      <p className="text-sm text-gray-500">Ocurrió un error al conectar con el servidor. Intentá de nuevo.</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
        >
          Intentar de nuevo
        </button>
        <Link
          href="/explorar"
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Volver a explorar
        </Link>
      </div>
    </div>
  );
}
