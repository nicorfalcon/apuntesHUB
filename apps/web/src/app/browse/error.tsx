"use client";

export default function BrowseError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-lg font-semibold text-foreground">No pudimos cargar los apuntes</p>
      <p className="text-sm text-gray-500">Ocurrió un error al conectar con el servidor. Intentá de nuevo.</p>
      <button
        onClick={reset}
        className="rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
