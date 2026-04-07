"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { getApunteById, usuarioMock } from "@/lib/mock-data";
import { PdfViewer } from "@/components/pdf-viewer";

function StarIcon() {
  return (
    <svg className="h-4 w-4 fill-amber-400" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export default function LectorPage() {
  const params = useParams();
  const id = params.id as string;
  const apunte = getApunteById(id);

  if (!apunte) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Apunte no encontrado.</p>
        <Link href="/" className="text-sm text-accent-600 hover:underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-gray-400">
        <Link href="/" className="hover:text-gray-600">Inicio</Link>
        <span className="mx-2">·</span>
        <Link href="/explorar" className="hover:text-gray-600">Explorar</Link>
        <span className="mx-2">·</span>
        <span className="text-foreground">{apunte.titulo}</span>
      </nav>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Visor PDF — columna principal */}
        <div className="flex-1">
          <PdfViewer apunteId={apunte.id} userEmail={usuarioMock.email} />
        </div>

        {/* Sidebar con metadata */}
        <aside className="w-full shrink-0 lg:w-72">
          <div className="sticky top-20 rounded-xl border border-gray-200 bg-white p-6">
            <h1 className="font-display text-lg font-bold text-foreground">
              {apunte.titulo}
            </h1>

            <p className="mt-2 text-sm text-gray-500">por {apunte.autor}</p>

            <div className="mt-4 flex items-center gap-1">
              <StarIcon />
              <span className="text-sm font-semibold text-foreground">
                {apunte.puntaje}
              </span>
              <span className="text-xs text-gray-400">
                ({apunte.totalReseñas} reseñas)
              </span>
            </div>

            <div className="mt-6 space-y-3 border-t border-gray-100 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Universidad</span>
                <span className="font-medium text-foreground">{apunte.universidad}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Materia</span>
                <span className="font-medium text-foreground">{apunte.materia}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Páginas</span>
                <span className="font-medium text-foreground">{apunte.paginas}</span>
              </div>
            </div>

            <div className="mt-6 border-t border-gray-100 pt-4">
              <div className="text-2xl font-bold text-accent-700">
                ${apunte.precio}{" "}
                <span className="text-sm font-normal text-gray-400">{apunte.moneda}</span>
              </div>
              <button className="mt-4 w-full rounded-lg bg-accent-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700">
                Comprar apunte
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
