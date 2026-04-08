import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/ui/star-rating";
import { ResumeCard } from "@/components/resume/resume-card";
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

  const [{ data: resumes }, { data: reviews }] = await Promise.all([
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
  ]);

  const initials = profile.display_name
    ? profile.display_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Encabezado del perfil */}
      <div className="flex items-start gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xl font-bold text-accent-700">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{profile.display_name}</h1>
          {(profile.university || profile.career) && (
            <p className="mt-0.5 text-sm text-gray-500">
              {[profile.career, profile.university].filter(Boolean).join(" · ")}
            </p>
          )}
          {profile.bio && <p className="mt-2 text-sm text-gray-600 max-w-lg">{profile.bio}</p>}
          {(profile.seller_rating_count ?? 0) > 0 && (
            <div className="mt-2">
              <StarRating
                rating={profile.seller_rating_avg ?? 0}
                count={profile.seller_rating_count ?? 0}
                size="md"
              />
            </div>
          )}
        </div>
      </div>

      {/* Apuntes publicados */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-foreground">
          Apuntes publicados ({resumes?.length ?? 0})
        </h2>
        {!resumes || resumes.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">Este vendedor no tiene apuntes publicados aún.</p>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(resumes as ResumeWithSeller[]).map((resume) => (
              <ResumeCard key={resume.id} resume={resume} />
            ))}
          </div>
        )}
      </section>

      {/* Reviews recibidas */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-foreground">
          Reseñas ({reviews?.length ?? 0})
        </h2>
        {!reviews || reviews.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">Todavía no hay reseñas para este vendedor.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {reviews.map((review) => {
              const r = review as Review & { profiles: Pick<Profile, "display_name"> };
              return (
                <div key={r.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{r.profiles.display_name}</span>
                    <StarRating rating={r.rating} />
                  </div>
                  {r.comment && (
                    <p className="mt-2 text-sm text-gray-600">{r.comment}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleDateString("es-AR")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
