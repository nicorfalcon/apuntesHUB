import { usuarioMock } from "@/lib/mock-data";

export default function PerfilPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
        Mi perfil
      </h1>

      <div className="mt-10 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-100 text-lg font-bold text-accent-700">
            {usuarioMock.avatar}
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              {usuarioMock.nombre}
            </h2>
            <p className="text-sm text-gray-500">{usuarioMock.email}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 text-center">
            <p className="text-2xl font-bold text-foreground">3</p>
            <p className="mt-1 text-xs text-gray-500">Apuntes comprados</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 text-center">
            <p className="text-2xl font-bold text-foreground">1</p>
            <p className="mt-1 text-xs text-gray-500">Apuntes publicados</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 text-center">
            <p className="text-2xl font-bold text-foreground">4.8</p>
            <p className="mt-1 text-xs text-gray-500">Puntaje promedio</p>
          </div>
        </div>
      </div>
    </div>
  );
}
