import Link from "next/link";
import { ScrollReveal } from "./scroll-reveal";

export function FinalCTA() {
  return (
    <section
      id="contacto"
      className="border-t border-accent-100 bg-accent-50 px-4 py-20 md:px-8 md:py-32"
    >
      <ScrollReveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-accent-600">
          Empezá hoy
        </p>
        <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
          Empezá a estudiar mejor{" "}
          <span className="text-muted-foreground">hoy mismo.</span>
        </h2>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          Creá tu cuenta gratis, explorá los apuntes de tu carrera y, si tenés
          material valioso, empezá a venderlo en minutos.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/register"
            className="rounded-full bg-accent-600 px-12 py-4 text-base font-medium text-white transition-all duration-200 hover:scale-[1.03] hover:brightness-110"
          >
            Empezar ahora
          </Link>
          <Link
            href="/browse"
            className="rounded-full border border-accent-200 px-12 py-4 text-base font-medium text-muted-foreground transition-all duration-200 hover:border-accent-400 hover:text-foreground"
          >
            Explorar apuntes
          </Link>
        </div>
      </ScrollReveal>
    </section>
  );
}
