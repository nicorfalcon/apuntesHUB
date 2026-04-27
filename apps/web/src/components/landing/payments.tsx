import { ScrollReveal } from "./scroll-reveal";
import { ShieldCheck, CreditCard, RefreshCcw, Clock } from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Pago 100% seguro",
    description: "Todas las transacciones pasan por Mercado Pago, la plataforma de pagos mas grande de LATAM.",
  },
  {
    icon: CreditCard,
    title: "Todos los medios",
    description: "Tarjeta de credito y debito, dinero en cuenta, Pago Facil, Rapipago y transferencia bancaria.",
  },
  {
    icon: Clock,
    title: "Hasta 12 cuotas",
    description: "Paga en cuotas sin interes con las tarjetas adheridas. Estudiar no tiene por que ser caro.",
  },
  {
    icon: RefreshCcw,
    title: "Devolucion garantizada",
    description: "Proximamente.",
  },
];

export function Payments() {
  return (
    <section className="border-b border-sand-400/50 bg-sand-100 px-4 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-warm-dark">/ Pagos y seguridad</span>
            <div className="h-px flex-1 bg-sand-400/50" />
          </div>
        </ScrollReveal>

        <div className="mt-12 grid gap-12 md:grid-cols-2">
          <div>
            <ScrollReveal>
              <h2 className="font-display text-4xl italic leading-tight text-sand-900 md:text-5xl">
                Paga seguro con{" "}
                <span className="text-warm">Mercado Pago.</span>
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={1}>
              <p className="mt-6 text-base leading-relaxed text-sand-800/60">
                Usamos Mercado Pago como unica pasarela de pagos. Tus datos
                financieros nunca pasan por nuestros servidores. Cada compra
                esta protegida por el programa de proteccion al comprador.
              </p>
            </ScrollReveal>

            {/* Payment methods visual */}
            <ScrollReveal delay={2}>
              <div className="mt-8 flex flex-wrap gap-3">
                {["Visa", "Mastercard", "AMEX", "Debito", "Pago Facil", "Rapipago", "Transferencia"].map((method) => (
                  <span
                    key={method}
                    className="rounded-lg border border-sand-400/50 bg-sand-200/50 px-3 py-1.5 text-xs font-medium text-sand-800/70"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </ScrollReveal>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <ScrollReveal key={feature.title} delay={(i % 3) as 0 | 1 | 2 | 3}>
                  <div className="flex h-full flex-col rounded-xl border border-sand-400/50 bg-sand-50 p-5">
                    <Icon className="h-5 w-5 text-warm" strokeWidth={1.5} />
                    <h3 className="mt-3 text-sm font-semibold text-sand-900">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-sand-800/60">
                      {feature.description}
                    </p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
