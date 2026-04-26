import { BadgeCheck, Filter, Users } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const FEATURES = [
  {
    icon: BadgeCheck,
    title: "Apuntes verificados",
    description:
      "Cada material es revisado y valorado por estudiantes que ya aprobaron la materia. Nada de contenido desactualizado o de dudosa calidad.",
    accent: "from-accent-500/20 to-accent-600/5",
    iconBg: "bg-gradient-to-br from-accent-200 to-accent-100",
    size: "lg" as const,
  },
  {
    icon: Filter,
    title: "Búsqueda por carrera y materia",
    description:
      "Filtros rápidos para encontrar exactamente lo que necesitás: tu universidad, tu carrera, tu materia. En segundos.",
    accent: "from-accent-400/15 to-accent-300/5",
    iconBg: "bg-gradient-to-br from-accent-100 to-accent-50",
    size: "md" as const,
  },
  {
    icon: Users,
    title: "Comunidad activa",
    description:
      "Comentarios, valoraciones y aportes de otros estudiantes. Cuanto más contribuís, más reputación construís en la plataforma.",
    accent: "from-accent-600/15 to-accent-500/5",
    iconBg: "bg-gradient-to-br from-accent-300/80 to-accent-200/60",
    size: "md" as const,
  },
] as const;

export function Features() {
  return (
    <section className="noise-bg mesh-accent-br px-4 py-20 md:px-8 md:py-32">
      <div className="mx-auto max-w-6xl">

        <ScrollReveal className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent-600">
            Por qué ApuntesHub
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
            Todo lo que necesitás{" "}
            <span className="font-display italic text-accent-700">para estudiar mejor.</span>
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            const isFirst = i === 0;
            return (
              <ScrollReveal key={feature.title} delay={(i + 1) as 1 | 2 | 3}>
                <div
                  className={`liquid-glass group flex h-full flex-col rounded-2xl p-8 transition-transform hover:scale-[1.02] ${
                    isFirst ? "md:row-span-1" : ""
                  }`}
                >
                  {/* Icon container — varied per card */}
                  <div
                    className={`flex items-center justify-center rounded-2xl text-accent-700 ${feature.iconBg} ${
                      isFirst
                        ? "h-16 w-16 shadow-inner"
                        : "h-14 w-14"
                    }`}
                  >
                    <Icon
                      className={isFirst ? "h-8 w-8" : "h-6 w-6"}
                      strokeWidth={1.5}
                    />
                  </div>

                  {/* Subtle gradient accent strip */}
                  <div
                    className={`mt-5 h-px w-16 rounded-full bg-gradient-to-r ${feature.accent}`}
                  />

                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
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
