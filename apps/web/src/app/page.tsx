import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/ui/star-rating";
import type { ResumeWithSeller } from "@/lib/database.types";
import { HeroSection } from "@/components/layout/hero-section";
import { Features } from "@/components/landing/features";
import { Stats } from "@/components/landing/stats";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FinalCTA } from "@/components/landing/final-cta";

export default async function LandingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/browse");

  const { data: topResumes } = await supabase
    .from("resumes")
    .select("*, profiles!seller_id(display_name, avatar_url, seller_rating_avg, seller_rating_count)")
    .eq("status", "published")
    .order("rating_avg", { ascending: false })
    .limit(3);

  const resumes = (topResumes as ResumeWithSeller[] | null) ?? [];

  return (
    <div className="min-h-screen">

      {/* ── Hero — cinematic, fullscreen video ─────────────── */}
      <HeroSection />

      {/* ── Features grid ──────────────────────────────────── */}
      <Features />

      {/* ── Stats banner ───────────────────────────────────── */}
      <Stats />

      {/* ── How it works — 3 steps ─────────────────────────── */}
      <HowItWorks />

      {/* ── Apuntes destacados ─────────────────────────────── */}
      {resumes.length > 0 && (
        <section className="border-t border-gray-100 px-4 py-20 md:px-8 md:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <p className="text-sm font-medium uppercase tracking-widest text-accent-600">
                Destacados
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
                Apuntes que otros{" "}
                <span className="text-muted-foreground">ya están usando.</span>
              </h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {resumes.map((resume) => (
                <Link
                  key={resume.id}
                  href={`/resume/${resume.id}`}
                  className="group rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  {resume.preview_url ? (
                    <div className="relative h-40 w-full overflow-hidden rounded-t-2xl">
                      <Image
                        src={resume.preview_url}
                        alt={resume.title}
                        fill
                        className="object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-t-2xl bg-accent-50">
                      <svg className="h-10 w-10 text-accent-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{resume.university}</span>
                      <span>·</span>
                      <span>{resume.subject}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-base font-semibold tracking-tight text-foreground group-hover:text-accent-600">
                      {resume.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      por {resume.profiles.display_name}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <StarRating
                        rating={resume.profiles.seller_rating_avg ?? 0}
                        count={resume.profiles.seller_rating_count ?? 0}
                      />
                      <span className="text-sm font-semibold text-accent-600">
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

      {/* ── Final CTA ──────────────────────────────────────── */}
      <FinalCTA />

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center text-sm text-muted-foreground md:flex-row md:justify-between">
          <span>
            © 2026 apuntes<span className="font-semibold text-foreground">HUB</span>. Todos los derechos reservados.
          </span>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-foreground transition-colors">Términos</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Privacidad</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Contacto</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
