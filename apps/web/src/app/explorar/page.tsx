import Link from "next/link";
import { apuntesMock } from "@/lib/mock-data";

function StarIcon() {
  return (
    <svg className="h-4 w-4 fill-amber-400" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export default function ExplorarPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
        Explorar apuntes
      </h1>
      <p className="mt-2 text-gray-500">
        Encontrá el material que necesitás para tu próximo examen.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {apuntesMock.map((apunte) => (
          <Link
            key={apunte.id}
            href={`/lector/${apunte.id}`}
            className="group rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{apunte.universidad}</span>
              <span>·</span>
              <span>{apunte.materia}</span>
            </div>
            <h3 className="mt-2 font-display text-base font-semibold text-foreground group-hover:text-accent-600">
              {apunte.titulo}
            </h3>
            <p className="mt-1 text-sm text-gray-500">por {apunte.autor}</p>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <StarIcon />
                <span className="text-sm font-medium text-foreground">
                  {apunte.puntaje}
                </span>
                <span className="text-xs text-gray-400">
                  ({apunte.totalReseñas})
                </span>
              </div>
              <span className="text-sm font-bold text-accent-700">
                ${apunte.precio} {apunte.moneda}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
