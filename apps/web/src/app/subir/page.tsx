export default function SubirPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
        Subir apunte
      </h1>
      <p className="mt-2 text-gray-500">
        Compartí tu material y empezá a generar ingresos.
      </p>

      <form className="mt-10 space-y-6" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block text-sm font-medium text-foreground">Título</label>
          <input
            type="text"
            placeholder="Ej: Resumen Derecho Constitucional — Unidad 3"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-foreground">Universidad</label>
            <input
              type="text"
              placeholder="Ej: UBA"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Materia</label>
            <input
              type="text"
              placeholder="Ej: Derecho Constitucional"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Precio (ARS)</label>
          <input
            type="number"
            placeholder="850"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Archivo PDF</label>
          <div className="mt-1 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-10">
            <p className="text-sm text-gray-400">Arrastrá tu PDF acá o hacé clic para seleccionar</p>
          </div>
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-accent-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
        >
          Publicar apunte
        </button>
      </form>
    </div>
  );
}
