import { ScrollReveal } from "./scroll-reveal";

// TODO: reemplazar con datos reales desde Supabase
const STATS = [
  { value: "+10.000", label: "apuntes publicados" },
  { value: "+50", label: "universidades" },
  { value: "+30.000", label: "estudiantes activos" },
] as const;

export function Stats() {
  return (
    <section className="border-y border-accent-100 bg-accent-50 px-4 py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          {STATS.map((stat, i) => (
            <ScrollReveal key={stat.label} delay={(i + 1) as 1 | 2 | 3} className="text-center">
              <p className="text-6xl font-bold tracking-tight text-accent-600 md:text-7xl">
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
