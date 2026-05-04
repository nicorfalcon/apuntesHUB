import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/ui/star-rating";
import { formatRelative } from "@/lib/utils/format-relative";
import type { Profile } from "@/lib/database.types";

type SellerReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string | null;
  source: "apunte" | "curso";
  reviewerName: string;
  itemTitle: string;
};

type TutorReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string | null;
  reviewerName: string;
  subject: string;
};

type ResumeReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string | null;
  profiles: Pick<Profile, "display_name"> | null;
  resumes: { title: string } | null;
};

type CourseReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string | null;
  profiles: Pick<Profile, "display_name"> | null;
  recorded_courses: { title: string; author_id: string } | null;
};

type TutorReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string | null;
  profiles: Pick<Profile, "display_name"> | null;
  tutor_bookings: { subjects: { name: string } | null } | null;
};

type Tab = "vendedor" | "profesor";

export default async function ReputacionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/reputation");

  const params = await searchParams;
  const requestedTab = params.tab === "profesor" ? "profesor" : "vendedor";

  const [
    { data: profile },
    { data: rawResumeReviews },
    { count: salesCount },
    { data: rawCourseReviews },
    { count: courseSalesCount },
    { data: rawTutorReviews },
    { count: tutorBookingsCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "is_tutor, seller_rating_avg, seller_rating_count, tutor_rating_avg, tutor_rating_count"
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("reviews")
      .select(
        "id, rating, comment, created_at, updated_at, profiles!reviewer_id(display_name), resumes!resume_id(title)"
      )
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("purchases")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "completed"),
    supabase
      .from("course_reviews")
      .select(
        "id, rating, comment, created_at, updated_at, profiles!reviewer_id(display_name), recorded_courses!inner(title, author_id)"
      )
      .eq("recorded_courses.author_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("course_enrollments")
      .select("recorded_courses!inner(author_id)", { count: "exact", head: true })
      .eq("recorded_courses.author_id", user.id)
      .eq("status", "completed"),
    supabase
      .from("tutor_reviews")
      .select(
        "id, rating, comment, created_at, updated_at, profiles!reviewer_id(display_name), tutor_bookings!booking_id(subjects(name))"
      )
      .eq("tutor_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tutor_bookings")
      .select("*", { count: "exact", head: true })
      .eq("tutor_id", user.id)
      .eq("status", "completed"),
  ]);

  const isTutor = profile?.is_tutor ?? false;
  const tutorRatingCount = profile?.tutor_rating_count ?? 0;
  const showTutorTab = isTutor || tutorRatingCount > 0;

  const tab: Tab = requestedTab === "profesor" && showTutorTab ? "profesor" : "vendedor";

  // ============= Vendedor: combina apuntes + cursos =============
  const resumeReviews = (rawResumeReviews ?? []) as unknown as ResumeReviewRow[];
  const courseReviews = (rawCourseReviews ?? []) as unknown as CourseReviewRow[];

  const sellerReviews: SellerReview[] = [
    ...resumeReviews.map((r) => ({
      id: `r-${r.id}`,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      updated_at: r.updated_at,
      source: "apunte" as const,
      reviewerName: r.profiles?.display_name ?? "Anónimo",
      itemTitle: r.resumes?.title ?? "—",
    })),
    ...courseReviews.map((r) => ({
      id: `c-${r.id}`,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      updated_at: r.updated_at,
      source: "curso" as const,
      reviewerName: r.profiles?.display_name ?? "Anónimo",
      itemTitle: r.recorded_courses?.title ?? "—",
    })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const sellerCount = sellerReviews.length;
  const sellerAvg =
    sellerCount > 0
      ? sellerReviews.reduce((sum, r) => sum + r.rating, 0) / sellerCount
      : 0;
  const sellerSales = (salesCount ?? 0) + (courseSalesCount ?? 0);

  // ============= Profesor: tutorías =============
  const tutorReviewsRaw = (rawTutorReviews ?? []) as unknown as TutorReviewRow[];
  const tutorReviews: TutorReview[] = tutorReviewsRaw.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    updated_at: r.updated_at,
    reviewerName: r.profiles?.display_name ?? "Anónimo",
    subject: r.tutor_bookings?.subjects?.name ?? "—",
  }));

  const tutorAvg = profile?.tutor_rating_avg ?? 0;
  const tutorCount = profile?.tutor_rating_count ?? 0;
  const tutorClasses = tutorBookingsCount ?? 0;

  // ============= Activo según tab =============
  const active = tab === "profesor"
    ? {
        avg: Number(tutorAvg),
        count: tutorCount,
        salesLabel: `${tutorClasses} ${tutorClasses === 1 ? "clase dictada" : "clases dictadas"}`,
        salesCount: tutorClasses,
        emptyHint: tutorClasses > 0
          ? `Llevás ${tutorClasses} ${tutorClasses === 1 ? "clase" : "clases"} esperando reseña.`
          : null,
      }
    : {
        avg: sellerAvg,
        count: sellerCount,
        salesLabel: `${sellerSales} ${sellerSales === 1 ? "venta" : "ventas"}`,
        salesCount: sellerSales,
        emptyHint: sellerSales > 0
          ? `Llevás ${sellerSales} ${sellerSales === 1 ? "venta" : "ventas"} esperando reseña.`
          : null,
      };

  const activeReviews = tab === "profesor" ? tutorReviews : sellerReviews;

  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: activeReviews.filter((r) => r.rating === star).length,
  }));

  const hasReviews = active.count > 0;
  const recommendationRate = hasReviews && activeReviews.length > 0
    ? Math.round(
        (activeReviews.filter((r) => r.rating >= 4).length / activeReviews.length) * 100
      )
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Reputación
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            {tab === "profesor"
              ? "Cómo te ven tus alumnos de clases particulares."
              : "Cómo te ven tus compradores."}
          </p>

          {/* Tabs */}
          {showTutorTab && (
            <div className="mt-6 inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1">
              <TabLink
                href="/reputation?tab=vendedor"
                active={tab === "vendedor"}
                label="Vendedor"
              />
              <TabLink
                href="/reputation?tab=profesor"
                active={tab === "profesor"}
                label="Profesor"
              />
            </div>
          )}
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
                  {Number(active.avg).toFixed(1)}
                </span>
                <div className="mt-2">
                  <StarRating rating={active.avg} size="md" />
                </div>
                <span className="mt-2 text-xs text-gray-400">
                  {active.count} {active.count === 1 ? "reseña" : "reseñas"}
                  <span className="mx-1.5 text-gray-300">·</span>
                  {active.salesLabel}
                </span>
              </div>

              {/* Separador */}
              <div className="hidden h-20 w-px bg-gray-100 sm:block" />

              {/* Barras */}
              <div className="flex-1 space-y-2.5">
                {breakdown.map(({ star, count }) => {
                  const pct =
                    active.count > 0
                      ? Math.round((count / active.count) * 100)
                      : 0;
                  return (
                    <div key={star} className="flex items-center gap-2.5">
                      <span className="w-3 text-right text-xs text-gray-400">
                        {star}
                      </span>
                      <svg
                        className="h-3 w-3 shrink-0 text-amber-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <div className="flex-1 overflow-hidden rounded-full bg-gray-100 h-1.5">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-5 text-right text-xs text-gray-400">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {recommendationRate > 0 && (
              <p className="mt-5 border-t border-gray-100 pt-4 text-xs text-gray-500">
                <span className="font-semibold text-accent-700">
                  {recommendationRate}%
                </span>{" "}
                de tus {tab === "profesor" ? "alumnos" : "compradores"} te calificaron con 4 o más estrellas.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg
                className="h-6 w-6 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                />
              </svg>
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">
              Todavía no tenés reseñas
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Cuando tus {tab === "profesor" ? "alumnos" : "compradores"} dejen reseñas, tu reputación aparecerá acá.
            </p>
            {active.emptyHint && (
              <p className="mt-3 text-xs text-gray-400">{active.emptyHint}</p>
            )}
          </div>
        )}

        {/* Lista de reseñas */}
        {activeReviews.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Reseñas recibidas
            </p>
            <div className="space-y-3">
              {activeReviews.map((review) => {
                const initial = review.reviewerName.charAt(0).toUpperCase();
                const subtitle =
                  tab === "profesor"
                    ? (review as TutorReview).subject
                    : `${(review as SellerReview).source === "curso" ? "Curso" : "Apunte"} · ${(review as SellerReview).itemTitle}`;
                return (
                  <div
                    key={review.id}
                    className="rounded-xl border border-gray-200 bg-white p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-50 text-sm font-semibold text-accent-700">
                        {initial}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {review.reviewerName}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-gray-400">
                              {subtitle}
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
                          {formatRelative(review.created_at)}
                          {review.updated_at && (
                            <span className="ml-1.5 italic">· editada</span>
                          )}
                        </p>
                      </div>
                    </div>
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

function TabLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-white text-foreground shadow-sm"
          : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </Link>
  );
}
