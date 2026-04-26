import Link from "next/link";
import { ScrollReveal } from "./scroll-reveal";

export function FinalCTA() {
  return (
    <section className="border-b border-sand-400/50 bg-sand-900 px-4 py-24 md:px-8 md:py-32">
      <ScrollReveal className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-warm-light/60">
          / Empeza hoy
        </p>
        <h2 className="mt-8 font-display text-4xl italic leading-tight text-sand-100 md:text-6xl">
          Tu proximo final empieza aca.
        </h2>
        <p className="mt-6 text-base leading-relaxed text-sand-400">
          Crea tu cuenta gratis, explora los apuntes de tu carrera y, si tenes
          material valioso, empeza a venderlo en minutos.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/register"
            className="rounded-lg bg-sand-100 px-8 py-3 text-sm font-medium text-sand-900 transition-colors hover:bg-white"
          >
            Empezar gratis
          </Link>
          <Link
            href="/browse"
            className="rounded-lg border border-sand-600 px-8 py-3 text-sm font-medium text-sand-300 transition-colors hover:border-sand-500 hover:text-sand-200"
          >
            Explorar apuntes
          </Link>
        </div>
      </ScrollReveal>
    </section>
  );
}
