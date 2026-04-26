"use client";

const WORDS = [
  "Resumenes",
  "Finales",
  "Parciales",
  "TPs",
  "Guias de estudio",
  "Apuntes de catedra",
  "Cheat sheets",
  "Ejercicios resueltos",
  "Teoria",
  "Formularios",
  "Mapas conceptuales",
  "Practicos",
];

export function Marquee() {
  const items = [...WORDS, ...WORDS];

  return (
    <section className="relative z-10 overflow-hidden border-y border-white/15 bg-white/[0.03] py-4 backdrop-blur-[2px]">
      <div className="flex animate-marquee whitespace-nowrap" aria-hidden="true">
        {items.map((word, i) => (
          <span key={i} className="mx-4 inline-flex items-center gap-4">
            <span className="text-base font-semibold text-white/62 sm:text-lg">
              {word}
            </span>
            <span className="text-[#87b5a8]/45" aria-hidden="true">/</span>
          </span>
        ))}
      </div>
    </section>
  );
}
