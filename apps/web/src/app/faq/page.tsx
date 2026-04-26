import Link from "next/link";
import { FAQS } from "@/components/landing/faq-data";

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-sand-100 px-4 py-16 md:px-8 md:py-24">
      <main className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-semibold text-warm-dark hover:text-warm">
          Volver al inicio
        </Link>

        <div className="mt-10">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-warm-dark">
            Apuntes Hub
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-sand-900 md:text-6xl">
            Preguntas frecuentes
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-sand-800/65">
            Todo lo importante sobre compras, ventas, pagos, calidad y seguridad dentro de la plataforma.
          </p>
        </div>

        <div className="mt-12 grid gap-5">
          {FAQS.map((faq) => (
            <article key={faq.q} className="rounded-xl border border-sand-400/50 bg-sand-50 p-6">
              <h2 className="text-lg font-bold tracking-tight text-sand-900">{faq.q}</h2>
              <p className="mt-3 text-sm leading-relaxed text-sand-800/65">{faq.a}</p>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
