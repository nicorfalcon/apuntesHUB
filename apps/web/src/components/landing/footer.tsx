"use client";

import Link from "next/link";

const COLUMNS = [
  {
    title: "Producto",
    links: [
      { label: "Explorar apuntes", href: "/explorar" },
      { label: "Vender apuntes", href: "/register" },
      { label: "Precios", href: "#precios" },
      { label: "Universidades", href: "/explorar" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre nosotros", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Contacto", href: "mailto:hola@apunteshub.com" },
      { label: "Trabaja con nosotros", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terminos y condiciones", href: "#" },
      { label: "Politica de privacidad", href: "#" },
      { label: "Politica de reembolsos", href: "#" },
      { label: "Propiedad intelectual", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-sand-900 px-4 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-5">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="text-xl font-bold tracking-tight text-sand-100">
              apuntes<span className="text-warm">HUB</span><span className="text-warm">.</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-sand-500">
              La plataforma donde estudiantes universitarios comparten, descubren
              y venden los mejores apuntes de su carrera.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-sand-500">
                {col.title}
              </p>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-sand-400 transition-colors hover:text-sand-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center gap-4 border-t border-sand-800 pt-8 text-center md:flex-row md:justify-between md:text-left">
          <p className="text-xs text-sand-600">
            &copy; 2026 apuntesHUB. Todos los derechos reservados.
          </p>
          <div className="flex gap-6">
            {[
              { label: "Instagram", href: "#" },
              { label: "Twitter", href: "#" },
              { label: "LinkedIn", href: "#" },
              { label: "TikTok", href: "#" },
            ].map((social) => (
              <a
                key={social.label}
                href={social.href}
                className="text-xs text-sand-600 transition-colors hover:text-sand-400"
                target="_blank"
                rel="noopener noreferrer"
              >
                {social.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
