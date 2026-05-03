"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Star } from "lucide-react";
import { toast } from "sonner";

interface ExistingReview {
  id: string;
  rating: number;
  comment: string | null;
}

interface CourseReviewFormProps {
  enrollmentId: string;
  courseId: string;
  existingReview?: ExistingReview;
  onClose: () => void;
}

export function CourseReviewForm({
  enrollmentId,
  courseId,
  existingReview,
  onClose,
}: CourseReviewFormProps) {
  const router = useRouter();
  const isEditing = Boolean(existingReview);
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (rating === 0) {
      setError("Seleccioná una calificación.");
      return;
    }
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Sesión expirada. Recargá la página.");
      setLoading(false);
      return;
    }

    if (isEditing && existingReview) {
      const { error: updateError } = await supabase
        .from("course_reviews")
        .update({ rating, comment: comment.trim() || null })
        .eq("id", existingReview.id);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      toast.success("Reseña actualizada.");
    } else {
      const { error: insertError } = await supabase.from("course_reviews").insert({
        enrollment_id: enrollmentId,
        course_id: courseId,
        reviewer_id: user.id,
        rating,
        comment: comment.trim() || null,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          toast.info("Ya reseñaste este curso.");
          onClose();
          router.refresh();
          return;
        }
        setError(insertError.message);
        setLoading(false);
        return;
      }
      toast.success("¡Reseña enviada!");
    }

    onClose();
    router.refresh();
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#0f1e1a]"
      >
        <h2 className="text-lg font-bold text-foreground">
          {isEditing ? "Editar reseña" : "Dejar una reseña"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu opinión ayuda a otros estudiantes a elegir.
        </p>

        <div className="mt-5 flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((value) => {
            const filled = (hovered || rating) >= value;
            return (
              <button
                type="button"
                key={value}
                onClick={() => setRating(value)}
                onMouseEnter={() => setHovered(value)}
                onMouseLeave={() => setHovered(0)}
                className="transition-transform hover:scale-110"
                aria-label={`${value} estrellas`}
              >
                <Star
                  className={`h-7 w-7 ${
                    filled
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300 dark:text-white/20"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Contale a otros qué aprendiste con este curso (opcional)"
          className="mt-4 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-white/10 dark:bg-white/[0.04]"
        />

        {error && (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-700 disabled:opacity-65 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
          >
            {loading ? "Guardando…" : isEditing ? "Actualizar" : "Publicar"}
          </button>
        </div>
      </form>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
