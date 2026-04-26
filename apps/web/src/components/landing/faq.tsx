"use client";

import Link from "next/link";
import { ScrollReveal } from "./scroll-reveal";

export const FAQS = [
  {
    q: "¿Es legal compartir apuntes?",
    a: "Si. Compartir apuntes propios, resumenes y guias de estudio que vos mismo elaboraste es completamente legal. Lo que no se puede subir es material con copyright de editoriales o fotocopias de libros. Cada apunte pasa por un proceso de revision.",
  },
  {
    q: "¿Como se que un apunte es de buena calidad antes de pagarlo?",
    a: "Todos los apuntes tienen vista previa gratuita de las primeras paginas. Ademas, podes ver el rating y los comentarios de otros estudiantes que ya lo compraron. Solo recomendamos material con 4+ estrellas.",
  },
  {
    q: "¿Que metodos de pago aceptan?",
    a: "Aceptamos todos los medios disponibles en Mercado Pago: tarjeta de credito y debito (Visa, Mastercard, AMEX), dinero en cuenta de Mercado Pago, Pago Facil, Rapipago y transferencia bancaria.",
  },
  {
    q: "¿Puedo pagar en cuotas con Mercado Pago?",
    a: "Si. Dependiendo de tu tarjeta, podes pagar en hasta 12 cuotas. Las cuotas sin interes dependen de las promociones vigentes de Mercado Pago con tu banco.",
  },
  {
    q: "¿Como funcionan los reembolsos?",
    a: "Si el apunte no coincide con la descripcion o tiene errores graves, podes pedir un reembolso dentro de las 72 horas posteriores a la compra. Evaluamos cada caso y, si corresponde, te devolvemos el 100% del dinero.",
  },
  {
    q: "¿Cuanto cobra Apuntes Hub si vendo mis apuntes?",
    a: "Cobramos una comision del 15% por cada venta. El 85% restante va directo a tu cuenta de Mercado Pago. No hay costos fijos ni cuotas mensuales para vender.",
  },
  {
    q: "¿En que universidades estan disponibles?",
    a: "Tenemos apuntes de mas de 50 universidades argentinas, incluyendo UBA, UTN, ITBA, UADE, UCA, UNLP, UNC, UNR y muchas mas. Si tu universidad no aparece, podes ser el primero en subir material.",
  },
  {
    q: "¿Los apuntes se actualizan cuando cambia el programa de la materia?",
    a: "Los vendedores pueden actualizar sus apuntes en cualquier momento. Marcamos con un badge \"Actualizado\" los que fueron revisados en el ultimo cuatrimestre. Si un apunte queda desactualizado, lo señalamos.",
  },
  {
    q: "¿Puedo descargar los apuntes para leerlos sin conexion?",
    a: "Si. Una vez que compras un apunte, lo podes descargar en PDF y leerlo offline desde cualquier dispositivo. El archivo queda disponible en tu cuenta para siempre.",
  },
  {
    q: "¿Que pasa si subo un apunte y alguien lo plagia?",
    a: "Tenemos un sistema de deteccion de contenido duplicado. Si detectamos que alguien sube tu material como propio, lo damos de baja y sancionamos la cuenta. Tambien podes reportar plagios desde el panel de vendedor.",
  },
  {
    q: "¿Hay version para profesores o catedras oficiales?",
    a: "Estamos trabajando en un programa para catedras que quieran distribuir material oficial a traves de la plataforma. Si sos profesor, escribinos a profesores@apunteshub.com.",
  },
  {
    q: "¿Tienen app mobile?",
    a: "Por ahora Apuntes Hub funciona como web app optimizada para celular. Podes agregarla a tu pantalla de inicio y usarla como si fuera una app nativa. La app para iOS y Android esta en desarrollo.",
  },
];

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
