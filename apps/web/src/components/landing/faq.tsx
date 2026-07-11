"use client";

import Link from "next/link";
import { ScrollReveal } from "./scroll-reveal";
// Fuente única: /faq y la landing mostraban copias distintas del mismo listado.
import { FAQS } from "./faq-data";


export function FAQ() {
  const featuredFaqs = FAQS.slice(0, 4);

  return (
    <section id="faq" className="border-b border-sand-400/50 bg-sand-100 px-4 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-warm-dark">/ Preguntas frecuentes</span>
            <div className="h-px flex-1 bg-sand-400/50" />
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <h2 className="mt-12 font-display text-4xl italic leading-tight text-sand-900 md:text-5xl">
            Preguntas frecuentes.
          </h2>
        </ScrollReveal>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {featuredFaqs.map((faq) => (
            <ScrollReveal key={faq.q}>
              <article className="h-full rounded-xl border border-sand-400/50 bg-sand-50 p-6 transition-all hover:border-warm/70 hover:shadow-[0_18px_45px_rgba(59,101,88,0.12)]">
                <h3 className="text-base font-bold tracking-tight text-sand-900">
                  {faq.q}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-sand-800/65">
                  {faq.a}
                </p>
              </article>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="mt-10 text-center">
            <Link
              href="/faq"
              className="inline-flex rounded-full border border-warm/40 px-7 py-3 text-sm font-semibold text-warm-dark transition-all hover:border-warm hover:bg-warm hover:text-white"
            >
              Ver más preguntas
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
