import { ScrollReveal } from "./scroll-reveal";

// TODO: reemplazar con datos reales desde Supabase
const STATS = [
  { value: "+10.000", label: "apuntes publicados" },
  { value: "+50", label: "universidades" },
  { value: "+30.000", label: "estudiantes activos" },
] as const;

export function Stats() {
  return (
    <section className="noise-bg relative overflow-hidden border-y border-accent-200/40 bg-accent-50 px-4 py-20 md:px-8 md:py-24">
      {/* Radial gradient for depth */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(59,101,88,0.08) 0%, transparent 60%), " +
            "radial-gradient(ellipse 60% 80% at 80% 100%, rgba(59,101,88,0.05) 0%, transparent 50%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          {STATS.map((stat, i) => (
            <ScrollReveal key={stat.label} delay={(i + 1) as 1 | 2 | 3} className="text-center">
              <p className="font-display text-6xl font-normal italic tracking-tight text-accent-700 md:text-7xl">
                {stat.value}
              </p>
              <p className="mt-3 text-sm font-medium uppercase tracking-widest text-accent-600/70">
                {stat.label}
              </p>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
