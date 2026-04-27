import { ScrollReveal } from "./scroll-reveal";
import { Cpu, Stethoscope, Scale, TrendingUp, BookOpen, Atom } from "lucide-react";

const CATEGORIES = [
  {
    name: "Ingenieria",
    count: "2.400+ apuntes",
    icon: Cpu,
    gradient: "from-sand-400/30 to-sand-300/50",
  },
  {
    name: "Medicina",
    count: "1.800+ apuntes",
    icon: Stethoscope,
    gradient: "from-sand-500/20 to-sand-400/40",
  },
  {
    name: "Derecho",
    count: "1.500+ apuntes",
    icon: Scale,
    gradient: "from-sand-400/25 to-sand-300/45",
  },
  {
    name: "Economicas",
    count: "2.100+ apuntes",
    icon: TrendingUp,
    gradient: "from-sand-500/25 to-sand-400/35",
  },
  {
    name: "Humanidades",
    count: "1.200+ apuntes",
    icon: BookOpen,
    gradient: "from-sand-400/20 to-sand-300/40",
  },
  {
    name: "Exactas",
    count: "900+ apuntes",
    icon: Atom,
    gradient: "from-sand-500/30 to-sand-400/50",
  },
];

export function Categories() {
  return (
    <section id="explorar" className="border-b border-sand-400/50 bg-sand-200/30 px-4 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-warm-dark">/ Categorias</span>
            <div className="h-px flex-1 bg-sand-400/50" />
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <h2 className="mt-12 max-w-2xl font-display text-4xl italic leading-tight text-sand-900 md:text-5xl">
            Explora por carrera.
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <ScrollReveal key={cat.name} delay={(i % 3) as 0 | 1 | 2 | 3}>
                <a
                  href={`/browse?career=${encodeURIComponent(cat.name)}`}
                  className="group flex items-center gap-5 rounded-xl border border-sand-400/50 bg-sand-100 p-6 transition-all hover:border-warm/40 hover:shadow-sm"
                >
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cat.gradient}`}>
                    <Icon className="h-6 w-6 text-sand-800/60" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-sand-900 group-hover:text-warm-dark">
                      {cat.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-sand-700/60">{cat.count}</p>
                  </div>
                </a>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
