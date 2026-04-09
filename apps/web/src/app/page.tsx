import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/ui/star-rating";
import type { ResumeWithSeller } from "@/lib/database.types";

const features = [
  {
    title: "Marketplace verificado",
    description:
      "Comprá y vendé apuntes con confianza. Cada material es revisado por la comunidad.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
  {
    title: "Lector seguro",
    description:
      "Leé los apuntes directamente en la plataforma con protección anti-piratería integrada.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
  },
  {
    title: "Sistema de puntaje",
    description:
      "Reseñas y calificaciones reales. Encontrá los mejores apuntes para cada materia.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
      </svg>
    ),
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: topResumes } = await supabase
    .from("resumes")
    .select("*, profiles!seller_id(display_name, avatar_url, seller_rating_avg, seller_rating_count)")
    .eq("status", "published")
    .order("rating_avg", { ascending: false })
    .limit(3);

  const resumes = (topResumes as ResumeWithSeller[] | null) ?? [];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-24 text-center md:pt-32">
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl">
          Comprá y vendé apuntes
          <br />
          <span className="text-accent-600">universitarios.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-gray-500">
          Calidad garantizada. Accedé a resúmenes, guías de estudio y material
          verificado por la comunidad estudiantil.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/register"
            className="rounded-lg bg-accent-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
          >
            Empezar gratis
          </Link>
          <Link
            href="/browse"
            className="rounded-lg border border-gray-300 px-8 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-gray-50"
          >
            Explorar apuntes
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-200 bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Todo lo que necesitás para estudiar mejor
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-gray-100 bg-gray-50/50 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                  {feature.icon}
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Apuntes destacados */}
      {resumes.length > 0 && (
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Apuntes destacados
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {resumes.map((resume) => (
                <Link
                  key={resume.id}
                  href={`/resume/${resume.id}`}
                  className="group rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
                >
                  {resume.preview_url ? (
                    <div className="relative h-40 w-full overflow-hidden rounded-t-xl">
                      <Image
                        src={resume.preview_url}
                        alt={resume.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-t-xl bg-gray-100">
                      <svg className="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{resume.university}</span>
                      <span>·</span>
                      <span>{resume.subject}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 font-display text-base font-semibold text-foreground group-hover:text-accent-600">
                      {resume.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">por {resume.profiles.display_name}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <StarRating
                        rating={resume.profiles.seller_rating_avg ?? 0}
                        count={resume.profiles.seller_rating_count ?? 0}
                      />
                      <span className="text-sm font-bold text-accent-700">
                        ${resume.price.toLocaleString("es-AR")} ARS
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA final */}
      <section className="border-t border-gray-200 bg-white py-20">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            ¿Tenés apuntes que pueden ayudar a otros?
          </h2>
          <p className="mt-4 text-gray-500">
            Subí tu material, poné tu precio y empezá a generar ingresos mientras
            ayudás a otros estudiantes.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-block rounded-lg bg-accent-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
          >
            Crear cuenta gratis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center text-sm text-gray-400 md:flex-row md:justify-between">
          <span>
            © 2026 apuntes<span className="font-semibold text-gray-500">HUB</span>. Todos los derechos reservados.
          </span>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-gray-600">Términos</Link>
            <Link href="#" className="hover:text-gray-600">Privacidad</Link>
            <Link href="#" className="hover:text-gray-600">Contacto</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
