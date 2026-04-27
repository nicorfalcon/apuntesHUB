import { ScrollReveal } from "./scroll-reveal";

const STATS = [
  { value: "10.000+", label: "apuntes publicados" },
  { value: "50+", label: "universidades" },
  { value: "30.000+", label: "estudiantes activos" },
  { value: "4.8", label: "rating promedio" },
];

export function AboutStats() {
  return (
    <section className="border-b border-sand-400/50 bg-sand-100 px-4 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-warm-dark">/ Nosotros</span>
            <div className="h-px flex-1 bg-sand-400/50" />
          </div>
        </ScrollReveal>

        <div className="mt-12 grid gap-12 md:grid-cols-2">
          <ScrollReveal>
            <h2 className="font-display text-4xl italic leading-tight text-sand-900 md:text-5xl">
              Creemos que el conocimiento{" "}
              <span className="text-warm">se comparte.</span>
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={1}>
            <p className="text-base leading-relaxed text-sand-800/60 md:text-lg">
              apuntesHUB nacio de una necesidad real: encontrar material de estudio
              de calidad para tu carrera, organizado y verificado por otros estudiantes
              que ya pasaron por ahi. No somos una editorial, somos una comunidad.
              Cada apunte que se sube hace que estudiar sea un poco mas facil para el
              que viene despues.
            </p>
          </ScrollReveal>
        </div>

        {/* Stats grid */}
        <div className="mt-20 grid grid-cols-2 gap-8 md:grid-cols-4">
          {STATS.map((stat, i) => (
            <ScrollReveal key={stat.label} delay={(i % 4) as 0 | 1 | 2 | 3}>
              <div className="text-center md:text-left">
                <p className="font-display text-5xl italic tracking-tight text-sand-900 md:text-6xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-sand-700/60">
                  {stat.label}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
