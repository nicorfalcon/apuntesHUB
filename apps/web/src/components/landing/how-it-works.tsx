import { ScrollReveal } from "./scroll-reveal";

const STEPS = [
  {
    number: "01",
    title: "Busca tu materia",
    description:
      "Filtra por universidad, carrera, materia o profesor. Encontra exactamente lo que necesitas en segundos.",
  },
  {
    number: "02",
    title: "Previsualiza antes de comprar",
    description:
      "Mira las primeras paginas gratis. Chequeá el estilo, la calidad y las valoraciones de otros estudiantes antes de decidir.",
  },
  {
    number: "03",
    title: "Descarga o compra",
    description:
      "Paga seguro con Mercado Pago, descarga al instante y empeza a estudiar. Asi de simple.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="border-b border-sand-400/50 bg-sand-100 px-4 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-warm-dark">/ Como funciona</span>
            <div className="h-px flex-1 bg-sand-400/50" />
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <h2 className="mt-12 max-w-2xl font-display text-4xl italic leading-tight text-sand-900 md:text-5xl">
            Tres pasos. Sin vueltas.
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, i) => (
            <ScrollReveal key={step.number} delay={(i + 1) as 1 | 2 | 3}>
              <div className="group">
                <div className="flex items-baseline gap-3">
                  <span className="text-xs font-medium uppercase tracking-[0.25em] text-warm-dark">
                    / {step.number}
                  </span>
                </div>
                <div className="mt-6 h-px w-full bg-sand-400/50" />
                <h3 className="mt-6 text-xl font-semibold tracking-tight text-sand-900">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-sand-800/60">
                  {step.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
