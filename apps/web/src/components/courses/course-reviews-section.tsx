import { Star } from "lucide-react";
import { CourseReviewButton } from "./course-review-button";

interface CourseReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
}

interface CourseReviewsSectionProps {
  courseId: string;
  reviews: CourseReviewItem[];
  /** Si el alumno tiene un enrollment completed, podemos dejarle reseñar. */
  reviewableEnrollmentId: string | null;
  hasExistingReview: boolean;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`h-4 w-4 ${
            value <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300 dark:text-white/20"
          }`}
        />
      ))}
    </div>
  );
}

export function CourseReviewsSection({
  courseId,
  reviews,
  reviewableEnrollmentId,
  hasExistingReview,
}: CourseReviewsSectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-foreground">Reseñas</h2>
        {reviewableEnrollmentId && (
          <CourseReviewButton
            enrollmentId={reviewableEnrollmentId}
            courseId={courseId}
            hasExistingReview={hasExistingReview}
          />
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 px-6 py-10 text-center dark:border-white/10 dark:bg-white/[0.03]">
          <p className="font-bold text-foreground">Todavía no hay reseñas.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sé el primero en compartir tu experiencia con este curso.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-50 text-sm font-bold text-accent-700 dark:bg-accent-300/10 dark:text-accent-100">
                    {(review.profiles?.display_name ?? "?")
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {review.profiles?.display_name ?? "Estudiante"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <StarRow rating={review.rating} />
              </div>
              {review.comment && (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {review.comment}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
