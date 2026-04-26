import { ScrollReveal } from "./scroll-reveal";

const STEPS = [
  {
    number: "01",
    title: "Buscá tu materia",
    description:
      "Usá los filtros de universidad y carrera para llegar exactamente al material que necesitás.",
  },
  {
    number: "02",
    title: "Descargá apuntes verificados",
    description:
      "Accedé a resúmenes y guías revisados por la comunidad. Comprá con confianza, pagá una sola vez.",
  },
  {
    number: "03",
    title: "Aportá los tuyos y sumá reputación",
    description:
      "Subí tu material, poné tu precio y construí tu perfil de vendedor mientras ayudás a otros.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="px-4 py-20 md:px-8 md:py-32">
      <div className="mx-auto max-w-6xl">

        <ScrollReveal className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent-600">
            Cómo funciona
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
            Tres pasos.{" "}
            <span className="text-muted-foreground">Sin vueltas.</span>
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <ScrollReveal key={step.number} delay={(i + 1) as 1 | 2 | 3}>
              <div className="flex flex-col gap-4">
                <span className="text-6xl font-bold leading-none tracking-tight text-accent-600/25 md:text-7xl">
                  {step.number}
                </span>
                <div className="h-px w-12 bg-accent-200" />
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
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
