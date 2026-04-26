import { BadgeCheck, Filter, Users } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const FEATURES = [
  {
    icon: BadgeCheck,
    title: "Apuntes verificados",
    description:
      "Cada material es revisado y valorado por estudiantes que ya aprobaron la materia. Nada de contenido desactualizado o de dudosa calidad.",
  },
  {
    icon: Filter,
    title: "Búsqueda por carrera y materia",
    description:
      "Filtros rápidos para encontrar exactamente lo que necesitás: tu universidad, tu carrera, tu materia. En segundos.",
  },
  {
    icon: Users,
    title: "Comunidad activa",
    description:
      "Comentarios, valoraciones y aportes de otros estudiantes. Cuanto más contribuís, más reputación construís en la plataforma.",
  },
] as const;

export function Features() {
  return (
    <section className="px-4 py-20 md:px-8 md:py-32">
      <div className="mx-auto max-w-6xl">

        <ScrollReveal className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent-600">
            Por qué ApuntesHub
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
            Todo lo que necesitás{" "}
            <span className="text-muted-foreground font-bold">para estudiar mejor.</span>
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <ScrollReveal key={feature.title} delay={(i + 1) as 1 | 2 | 3}>
                <div className="liquid-glass flex h-full flex-col rounded-2xl p-8 transition-transform hover:scale-[1.02]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-100 text-accent-600">
                    <Icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
