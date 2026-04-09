import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-bold text-accent-600">404</p>
      <h1 className="mt-4 text-2xl font-bold text-foreground">No encontramos lo que buscás</h1>
      <p className="mt-2 text-gray-500">
        La página que intentás visitar no existe o fue movida.
      </p>
      <Link
        href="/browse"
        className="mt-8 rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
      >
        Explorar apuntes
      </Link>
    </div>
  );
}
