import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/ui/star-rating";
import type { Profile } from "@/lib/database.types";

type ReviewWithJoins = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string | null;
  profiles: Pick<Profile, "display_name"> | null;
  resumes: { title: string } | null;
};

export default async function ReputacionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/reputation");

  const [{ data: profile }, { data: rawReviews }, { count: salesCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("seller_rating_avg, seller_rating_count")
      .eq("id", user.id)
      .single(),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, updated_at, profiles!reviewer_id(display_name), resumes!resume_id(title)")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("purchases")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "completed"),
  ]);

  const reviews = (rawReviews ?? []) as unknown as ReviewWithJoins[];
  const ratingAvg = profile?.seller_rating_avg ?? 0;
  const ratingCount = profile?.seller_rating_count ?? 0;
  const totalSales = salesCount ?? 0;

  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  const hasReviews = ratingCount > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Reputación
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Cómo te ven tus compradores.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 space-y-5">

        {/* Score card */}
        {hasReviews ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">

              {/* Número grande + estrellas */}
              <div className="flex flex-col items-center sm:min-w-[128px]">
                <span className="text-6xl font-bold tracking-tight text-foreground">
                  {Number(ratingAvg).toFixed(1)}
                </span>
                <div className="mt-2">
                  <StarRating rating={ratingAvg} size="md" />
                </div>
                <span className="mt-2 text-xs text-gray-400">
                  {ratingCount} {ratingCount === 1 ? "reseña" : "reseñas"}
                </span>
              </div>

              {/* Separador */}
              <div className="hidden h-20 w-px bg-gray-100 sm:block" />

              {/* Barras */}
              <div className="flex-1 space-y-2.5">
                {breakdown.map(({ star, count }) => {
                  const pct = ratingCount > 0 ? Math.round((count / ratingCount) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-2.5">
                      <span className="w-3 text-right text-xs text-gray-400">{star}</span>
                      <svg className="h-3 w-3 shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <div className="flex-1 overflow-hidden rounded-full bg-gray-100 h-1.5">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-5 text-right text-xs text-gray-400">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">Todavía no tenés reseñas</p>
            <p className="mt-1 text-sm text-gray-400">
              Cuando tus compradores dejen reseñas, tu reputación aparecerá acá.
            </p>
          </div>
        )}

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Reseñas</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{ratingCount}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Ventas</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{totalSales}</p>
          </div>
        </div>

        {/* Lista de reseñas */}
        {reviews.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Reseñas recibidas
            </p>
            <div className="space-y-3">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {review.profiles?.display_name ?? "—"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-400">
                        {review.resumes?.title ?? "—"}
                      </p>
                    </div>
                    <StarRating rating={review.rating} size="sm" />
                  </div>

                  {review.comment && (
                    <p className="mt-3 text-sm leading-relaxed text-gray-600">
                      {review.comment}
                    </p>
                  )}

                  <p className="mt-2.5 text-xs text-gray-400">
                    {new Date(review.created_at).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {review.updated_at && (
                      <span className="ml-1.5 italic">· editada</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
