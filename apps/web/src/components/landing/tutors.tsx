"use client";

import { useState } from "react";
import Link from "next/link";
import { ScrollReveal } from "./scroll-reveal";
import { PLATFORM_FEE_PERCENT, formatPercent } from "@/lib/fees";

const COMMISSION = PLATFORM_FEE_PERCENT.tutoring;

export function Tutors() {
  const [rate, setRate] = useState(12000);

  const earnings = Math.round(rate * (1 - COMMISSION / 100));

  return (
    <section
      id="clases"
      className="border-b border-sand-400/50 px-4 py-24 md:px-8 md:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-warm-dark">
              / Clases particulares
            </span>
            <div className="h-px flex-1 bg-sand-400/50" />
          </div>
        </ScrollReveal>

        <div className="mt-12 grid gap-12 md:grid-cols-2">
          <div>
            <ScrollReveal>
              <h2 className="font-display text-4xl italic leading-tight text-sand-900 md:text-5xl">
                Tomá clases.{" "}
                <span className="text-warm">O dalas vos.</span>
              </h2>
            </ScrollReveal>

            <ScrollReveal delay={1}>
              <p className="mt-6 text-base leading-relaxed text-sand-800/60">
                Encontrá un profesor de tu materia, con la tarifa y los horarios a la
                vista, y reservá la clase en el momento. Y si sos vos el que la tiene
                clara, publicá tus materias y cobrá por ayudar.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={2}>
              <div className="mt-8 grid gap-8 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-sand-700/60">
                    Si buscás profe
                  </p>
                  <div className="mt-4 space-y-3">
                    {[
                      "Filtrá por materia, modalidad y precio",
                      "Elegís el horario según su disponibilidad",
                      "Pagás la clase de forma segura",
                      "Coordinás los detalles por mensajes",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <span className="mt-1 text-warm">/</span>
                        <span className="text-sm text-sand-800/70">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-sand-700/60">
                    Si querés dar clases
                  </p>
                  <div className="mt-4 space-y-3">
                    {[
                      "Vos ponés la tarifa de cada materia",
                      "Cargás tus horarios disponibles",
                      `Comisión de solo ${formatPercent(COMMISSION)}%`,
                      "Cobrás directo a tu Mercado Pago",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <span className="mt-1 text-warm">/</span>
                        <span className="text-sm text-sand-800/70">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={3}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/explorar?tab=particulares"
                  className="rounded-lg bg-sand-900 px-5 py-3 text-sm font-medium text-sand-100 transition-colors hover:bg-sand-900/90"
                >
                  Buscar un profesor
                </Link>
                <Link
                  href="/sell/new?type=profesores"
                  className="rounded-lg border border-sand-400/70 px-5 py-3 text-sm font-medium text-sand-900 transition-colors hover:bg-sand-200/50"
                >
                  Quiero dar clases
                </Link>
              </div>
            </ScrollReveal>
          </div>

          {/* Calculadora del profe: la comisión de clases es la más baja de la plataforma. */}
          <ScrollReveal delay={1}>
            <div className="rounded-xl border border-sand-400/50 bg-sand-100 p-8">
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-warm-dark">
                Cuánto cobrás por clase
              </p>
              <div className="mt-6">
                <label htmlFor="rate-slider" className="text-sm text-sand-800/60">
                  Tu tarifa por hora
                </label>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-4xl italic text-sand-900">
                    ${rate.toLocaleString("es-AR")}
                  </span>
                  <span className="text-sm text-sand-700/60">ARS</span>
                </div>
                <input
                  id="rate-slider"
                  type="range"
                  min={2000}
                  max={40000}
                  step={1000}
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="mt-4 w-full accent-warm"
                  aria-label="Tarifa por hora"
                />
                <div className="mt-1 flex justify-between text-xs text-sand-700/50">
                  <span>$2.000</span>
                  <span>$40.000</span>
                </div>
              </div>

              <div className="mt-8 h-px w-full bg-sand-400/50" />

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-sand-700/60">
                    Comisión ({formatPercent(COMMISSION)}%)
                  </p>
                  <p className="mt-1 font-display text-xl italic text-sand-700/50">
                    -${(rate - earnings).toLocaleString("es-AR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-sand-700/60">Vos te llevás</p>
                  <p className="mt-1 font-display text-xl italic text-warm-dark">
                    ${earnings.toLocaleString("es-AR")}
                  </p>
                </div>
              </div>

              <p className="mt-6 text-xs text-sand-700/50">
                Si das 4 clases por semana ={" "}
                <span className="font-semibold text-sand-900">
                  ${(earnings * 16).toLocaleString("es-AR")}/mes
                </span>
              </p>
              <p className="mt-2 text-xs text-sand-700/40">
                * Mercado Pago descuenta un pequeño porcentaje adicional por procesamiento
                de la transacción.
              </p>

              <Link
                href="/sell/new?type=profesores"
                className="mt-6 block w-full rounded-lg bg-sand-900 py-3 text-center text-sm font-medium text-sand-100 transition-colors hover:bg-sand-900/90"
              >
                Publicar mis materias
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
