import { notFound } from "next/navigation";
import Image from "next/image";
import { BookOpen, ShoppingCart, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/ui/star-rating";
import { ResumeCard } from "@/components/resume/resume-card";
import { ProfileNavbar } from "./profile-navbar";
import type { ResumeWithSeller, Review, Profile } from "@/lib/database.types";

export default async function PerfilPublicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!rawProfile) notFound();
  const profile = rawProfile as Profile;

  const [{ data: resumes }, { data: reviews }, { count: salesCount }] = await Promise.all([
    supabase
      .from("resumes")
      .select("*, profiles!seller_id(display_name, avatar_url, seller_rating_avg, seller_rating_count)")
      .eq("seller_id", id)
      .eq("status", "published")
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("*, profiles!reviewer_id(display_name)")
      .eq("seller_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("purchases")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", id)
      .eq("status", "completed"),
  ]);

  const initials = profile.display_name
    ? profile.display_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const uniqueUniversities = Array.from(
    new Set((resumes ?? []).map((r) => r.university).filter(Boolean))
  );

  const totalResumes = resumes?.length ?? 0;
  const totalSales = salesCount ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <ProfileNavbar />

      <div className="mx-auto max-w-6xl px-4 py-8">

        {/* ── Fila superior: card vendedor + card estadísticas ── */}
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[2fr_1fr]">

          {/* Card vendedor */}
          <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            {/* Avatar + info principal */}
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-accent-100 text-2xl font-bold text-accent-700 overflow-hidden">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    width={80}
                    height={80}
                    className="rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>

              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-gray-900">{profile.display_name}</h1>

                {(profile.university || profile.career) && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-600">
                    <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
                    {[profile.university, profile.career].filter(Boolean).join(" · ")}
                  </span>
                )}

                {(profile.seller_rating_count ?? 0) > 0 && (
                  <div className="flex items-center gap-1.5">
                    <StarRating
                      rating={profile.seller_rating_avg ?? 0}
                      count={profile.seller_rating_count ?? 0}
                      size="md"
                    />
                    <span className="text-sm text-gray-400">/ 5.0</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <>
                <div className="my-5 border-t border-gray-100" />
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Acerca de
                  </p>
                  <p className="text-sm leading-relaxed text-gray-700">{profile.bio}</p>
                </div>
              </>
            )}
          </div>

          {/* Card estadísticas */}
          <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Estadísticas</h2>

            <div className="flex flex-col divide-y divide-gray-100">
              {/* Total de apuntes */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span className="text-sm">Total de Apuntes</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{totalResumes}</span>
              </div>

              {/* Ventas totales */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <ShoppingCart className="h-4 w-4 shrink-0" />
                  <span className="text-sm">Ventas Totales</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{totalSales}</span>
              </div>

              {/* Universidades */}
              <div className="py-3">
                <div className="flex items-start gap-2 text-gray-500">
                  <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm">Universidades</span>
                    {uniqueUniversities.length === 0 ? (
                      <p className="mt-0.5 text-sm text-gray-400">—</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5">
                        {uniqueUniversities.map((uni) => (
                          <li key={uni} className="text-sm font-medium text-gray-700">{uni}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Apuntes publicados ── */}
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Apuntes Publicados{" "}
            <span className="text-gray-400">({totalResumes})</span>
          </h2>

          {totalResumes === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <p className="text-sm text-gray-400">Este vendedor no tiene apuntes publicados aún.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(resumes as ResumeWithSeller[]).map((resume) => (
                <ResumeCard key={resume.id} resume={resume} />
              ))}
            </div>
          )}
        </div>

        {/* ── Reseñas ── */}
        {reviews && reviews.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Reseñas{" "}
              <span className="text-gray-400">({reviews.length})</span>
            </h2>
            <div className="space-y-3">
              {reviews.map((review) => {
                const r = review as Review & { profiles: Pick<Profile, "display_name"> };
                return (
                  <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">{r.profiles.display_name}</span>
                      <StarRating rating={r.rating} />
                    </div>
                    {r.comment && (
                      <p className="mt-2 text-sm text-gray-600">{r.comment}</p>
                    )}
                    <p className="mt-1.5 text-xs text-gray-400">
                      {new Date(r.created_at).toLocaleDateString("es-AR")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
