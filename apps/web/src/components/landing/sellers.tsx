"use client";

import { useState } from "react";
import Link from "next/link";
import { ScrollReveal } from "./scroll-reveal";

const COMMISSION = 10; // porcentaje que cobra ApuntesHub

export function Sellers() {
  const [price, setPrice] = useState(2000);

  const earnings = Math.round(price * (1 - COMMISSION / 100));

  return (
    <section id="vendedores" className="border-b border-sand-400/50 bg-sand-200/30 px-4 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-warm-dark">/ Para vendedores</span>
            <div className="h-px flex-1 bg-sand-400/50" />
          </div>
        </ScrollReveal>

        <div className="mt-12 grid gap-12 md:grid-cols-2">
          <div>
            <ScrollReveal>
              <h2 className="font-display text-4xl italic leading-tight text-sand-900 md:text-5xl">
                Converti tus apuntes{" "}
                <span className="text-warm">en plata.</span>
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={1}>
              <p className="mt-6 text-base leading-relaxed text-sand-800/60">
                Esos resumenes que te llevaron horas tienen valor. Subi tu material,
                ponele el precio que quieras y empeza a ganar por cada venta.
                Vos te quedas con el {100 - COMMISSION}% de cada venta.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={2}>
              <div className="mt-8 space-y-3">
                {[
                  "Vos elegis el precio de tus apuntes",
                  `Comision transparente: solo el ${COMMISSION}%`,
                  "Cobras directo a tu cuenta de Mercado Pago",
                  "Dashboard con metricas de ventas",
                  "Sin exclusividad: tu material sigue siendo tuyo",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="mt-1 text-warm">/</span>
                    <span className="text-sm text-sand-800/70">{item}</span>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>

          {/* Calculadora */}
          <ScrollReveal delay={1}>
            <div className="rounded-xl border border-sand-400/50 bg-sand-100 p-8">
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-warm-dark">
                Calculadora de ganancias
              </p>
              <div className="mt-6">
                <label htmlFor="price-slider" className="text-sm text-sand-800/60">
                  Precio por apunte
                </label>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-4xl italic text-sand-900">
                    ${price.toLocaleString("es-AR")}
                  </span>
                  <span className="text-sm text-sand-700/60">ARS</span>
                </div>
                <input
                  id="price-slider"
                  type="range"
                  min={500}
                  max={15000}
                  step={500}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="mt-4 w-full accent-warm"
                  aria-label="Precio del apunte"
                />
                <div className="mt-1 flex justify-between text-xs text-sand-700/50">
                  <span>$500</span>
                  <span>$15.000</span>
                </div>
              </div>

              <div className="mt-8 h-px w-full bg-sand-400/50" />

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-sand-700/60">Comision ({COMMISSION}%)</p>
                  <p className="mt-1 font-display text-xl italic text-sand-700/50">
                    -${(price - earnings).toLocaleString("es-AR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-sand-700/60">Vos te llevas</p>
                  <p className="mt-1 font-display text-xl italic text-warm-dark">
                    ${earnings.toLocaleString("es-AR")}
                  </p>
                </div>
              </div>

              <p className="mt-6 text-xs text-sand-700/50">
                Si vendes 10 copias al mes = <span className="font-semibold text-sand-900">${(earnings * 10).toLocaleString("es-AR")}/mes</span>
              </p>
              <p className="mt-2 text-xs text-sand-700/40">
                * Mercado Pago descuenta un pequeño porcentaje adicional por procesamiento de la transacción.
              </p>

              <Link
                href="/register"
                className="mt-6 block w-full rounded-lg bg-sand-900 py-3 text-center text-sm font-medium text-sand-100 transition-colors hover:bg-sand-900/90"
              >
                Empezar a vender
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
