import { ScrollReveal } from "./scroll-reveal";

const TESTIMONIALS = [
  {
    name: "Camila Rossi",
    career: "Ingenieria Industrial",
    university: "UTN FRBA",
    quote: "Encontre todos los resumenes de Analisis Matematico II en un solo lugar. Aprobe con 8 gracias a los apuntes de aca.",
    initials: "CR",
  },
  {
    name: "Tomas Alvarez",
    career: "Abogacia",
    university: "UBA - Derecho",
    quote: "Subi mis resumenes de Derecho Penal y en el primer mes ya habia vendido 40 copias. La plataforma es muy intuitiva.",
    initials: "TA",
  },
  {
    name: "Valentina Lopez",
    career: "Medicina",
    university: "UBA - Medicina",
    quote: "La preview antes de comprar es clave. Podes ver el estilo del apunte y si te sirve antes de gastar un peso.",
    initials: "VL",
  },
  {
    name: "Santiago Mendez",
    career: "Ciencias Economicas",
    university: "UADE",
    quote: "El sistema de reputacion le da mucha confianza. Solo compro apuntes con 4+ estrellas y nunca me fallo.",
    initials: "SM",
  },
  {
    name: "Lucia Ferreyra",
    career: "Psicologia",
    university: "UNC",
    quote: "Como vendedora, me encanta el dashboard de metricas. Se exactamente cuantos estudiantes usan mis guias.",
    initials: "LF",
  },
  {
    name: "Martin Gimenez",
    career: "Sistemas",
    university: "ITBA",
    quote: "Pagar con Mercado Pago en cuotas es un golazo. Compre el pack completo de materias del cuatrimestre sin drama.",
    initials: "MG",
  },
];

export function Testimonials() {
  return (
    <section className="border-b border-sand-400/50 bg-sand-100 px-4 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-warm-dark">/ Testimonios</span>
            <div className="h-px flex-1 bg-sand-400/50" />
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <h2 className="mt-12 max-w-2xl font-display text-4xl italic leading-tight text-sand-900 md:text-5xl">
            Lo que dicen nuestros estudiantes.
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <ScrollReveal key={t.name} delay={(i % 3) as 0 | 1 | 2 | 3}>
              <div className="flex h-full flex-col rounded-xl border border-sand-400/50 bg-sand-50 p-6">
                <p className="flex-1 text-sm leading-relaxed text-sand-800/70">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-6 flex items-center gap-3 border-t border-sand-400/40 pt-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sand-300/60 text-xs font-semibold text-sand-800/70">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-sand-900">{t.name}</p>
                    <p className="text-xs text-sand-700/60">{t.career} — {t.university}</p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
