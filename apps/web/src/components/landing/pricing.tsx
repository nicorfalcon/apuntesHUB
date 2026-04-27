import Link from "next/link";
import { ScrollReveal } from "./scroll-reveal";
import { Check } from "lucide-react";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "para siempre",
    description: "Perfecto para empezar a explorar.",
    features: [
      "Buscar y explorar apuntes",
      "Vista previa de primeras paginas",
      "Comprar apuntes individuales",
      "Subir hasta 3 apuntes para vender",
      "Soporte por email",
    ],
    cta: "Crear cuenta gratis",
    href: "/register",
    featured: false,
  },
  {
    name: "Estudiante",
    price: "$2.990",
    period: "/mes",
    description: "Acceso ilimitado para estudiar en serio.",
    features: [
      "Todo lo del plan Free",
      "Acceso anticipado a material nuevo",
      "Subir apuntes ilimitados para vender",
      "Filtros avanzados de busqueda",
      "Sin publicidad",
      "Soporte prioritario",
    ],
    cta: "Empezar prueba gratis",
    href: "/register?plan=student",
    featured: true,
  },
  {
    name: "Anual",
    price: "$24.990",
    period: "/año",
    description: "Ahorra 30% pagando anual.",
    features: [
      "Todo lo del plan Estudiante",
      "Equivale a $2.082/mes",
      "2 meses gratis vs. plan mensual",
      "Badge de miembro premium",
      "Acceso a comunidad exclusiva",
      "Estadisticas avanzadas de vendedor",
    ],
    cta: "Suscribirse anual",
    href: "/register?plan=annual",
    featured: false,
  },
];

export function Pricing() {
  return (
    <section id="precios" className="border-b border-sand-400/50 bg-sand-200/30 px-4 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-warm-dark">/ Precios</span>
            <div className="h-px flex-1 bg-sand-400/50" />
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="mt-12 flex flex-wrap items-center gap-4">
            <h2 className="font-display text-4xl italic leading-tight text-sand-900 md:text-5xl">
              Simple y transparente.
            </h2>
            <span className="inline-flex items-center rounded-full border border-warm/40 bg-warm/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-warm-dark">
              Próximamente
            </span>
          </div>
          <p className="mt-4 text-base text-sand-800/60">
            Empeza gratis. Escala cuando lo necesites.
          </p>
        </ScrollReveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <ScrollReveal key={plan.name} delay={(i + 1) as 1 | 2 | 3}>
              <div
                className={`flex h-full flex-col rounded-xl border p-8 transition-shadow ${
                  plan.featured
                    ? "border-warm/50 bg-sand-100 shadow-md"
                    : "border-sand-400/50 bg-sand-50"
                }`}
              >
                {plan.featured && (
                  <span className="mb-4 inline-flex w-fit rounded-full bg-warm/10 px-3 py-1 text-xs font-medium text-warm-dark">
                    Mas popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-sand-900">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-4xl italic text-sand-900">
                    {plan.price}
                  </span>
                  <span className="text-sm text-sand-700/60">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-sand-800/60">{plan.description}</p>

                <div className="mt-6 h-px w-full bg-sand-400/40" />

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-warm" strokeWidth={2} />
                      <span className="text-sm text-sand-800/70">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`mt-8 block w-full rounded-lg py-3 text-center text-sm font-medium transition-colors ${
                    plan.featured
                      ? "bg-sand-900 text-sand-100 hover:bg-sand-900/90"
                      : "border border-sand-400 bg-sand-100 text-sand-900 hover:bg-sand-300/50"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
