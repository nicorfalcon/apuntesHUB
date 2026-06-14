import { ScrollReveal } from "./scroll-reveal";
import { MessageSquareText, ListChecks, Search } from "lucide-react";

const TOOLS = [
  {
    icon: MessageSquareText,
    title: "Chateá con tus apuntes",
    description:
      "Preguntá lo que no entendés y obtené respuestas al instante, con citas a las páginas exactas del material. Como tener al autor del apunte al lado.",
    gradient: "from-sand-400/30 to-sand-300/50",
  },
  {
    icon: ListChecks,
    title: "Modo estudio",
    description:
      "Generá preguntas de práctica a partir de cualquier apunte y ponete a prueba. Repasá lo que importa antes del parcial, sin armar el cuestionario vos.",
    gradient: "from-sand-500/20 to-sand-400/40",
  },
  {
    icon: Search,
    title: "Búsqueda por temas",
    description:
      "Buscá por concepto, no solo por título. Encontrá el apunte que explica un tema puntual aunque no figure en el nombre, con tolerancia a errores de tipeo.",
    gradient: "from-sand-400/25 to-sand-300/45",
  },
];

export function StudyAI() {
  return (
    <section
      id="estudiar-ia"
      className="border-b border-sand-400/50 bg-sand-200/30 px-4 py-24 md:px-8 md:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-warm-dark">
              / Estudiá con IA
            </span>
            <div className="h-px flex-1 bg-sand-400/50" />
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <h2 className="mt-12 max-w-2xl font-display text-4xl italic leading-tight text-sand-900 md:text-5xl">
            Estudiá, no solo leas.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-sand-800/60">
            Cada apunte que comprás viene con herramientas de IA para entenderlo
            más rápido: preguntale, repasá con preguntas de práctica y encontrá
            justo el tema que necesitás.
          </p>
        </ScrollReveal>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool, i) => {
            const Icon = tool.icon;
            return (
              <ScrollReveal key={tool.title} delay={(i + 1) as 1 | 2 | 3}>
                <div className="flex h-full flex-col rounded-xl border border-sand-400/50 bg-sand-100 p-8 transition-all hover:border-warm/40 hover:shadow-sm">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient}`}
                  >
                    <Icon
                      className="h-6 w-6 text-sand-800/60"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight text-sand-900">
                    {tool.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-sand-800/60">
                    {tool.description}
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
