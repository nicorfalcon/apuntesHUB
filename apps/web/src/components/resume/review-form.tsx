"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ExistingReview {
  id: string;
  rating: number;
  comment: string | null;
}

interface ReviewFormProps {
  purchaseId: string;
  resumeId: string;
  sellerId: string;
  existingReview?: ExistingReview;
  onClose: () => void;
}

export function ReviewForm({ purchaseId, resumeId, sellerId, existingReview, onClose }: ReviewFormProps) {
  const router = useRouter();
  const isEditing = !!existingReview;
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError("Seleccioná una calificación."); return; }
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { setError("Sesión expirada. Recargá la página."); setLoading(false); return; }

    if (isEditing) {
      // Modo edición: actualizar reseña existente
      const { error: updateError } = await supabase
        .from("reviews")
        .update({ rating, comment: comment.trim() || null })
        .eq("id", existingReview.id);

      if (updateError) {
        console.error("Review update error:", updateError);
        setError(updateError.message);
        setLoading(false);
        return;
      }

      toast.success("Reseña actualizada.");
    } else {
      // Modo creación: insertar nueva reseña
      const { error: insertError } = await supabase.from("reviews").insert({
        purchase_id: purchaseId,
        reviewer_id: user.id,
        seller_id: sellerId,
        resume_id: resumeId,
        rating,
        comment: comment.trim() || null,
      });

      if (insertError) {
        console.error("Review insert error:", insertError);
        if (insertError.code === "23505") {
          toast.info("Ya reseñaste este apunte.");
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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#0f1e1a]">
        <h2 className="text-lg font-bold text-foreground">
          {isEditing ? "Editar reseña" : "Dejar reseña"}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-sand-300/75">
          {isEditing
            ? "Podés cambiar tu calificación o comentario."
            : "Tu opinión ayuda a otros estudiantes a elegir mejor."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-sand-100">Calificación *</p>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="p-0.5 focus:outline-none"
                >
                  <svg
                    className={`h-8 w-8 transition-colors ${star <= (hovered || rating) ? "text-amber-400" : "text-gray-200 dark:text-white/10"}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 dark:text-sand-100">
              Comentario (opcional)
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="¿Qué te pareció el apunte?"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 dark:border-white/15 dark:bg-white/5 dark:text-sand-50 dark:placeholder:text-sand-300/45"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-accent-600 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
            >
              {loading ? "Guardando..." : isEditing ? "Guardar cambios" : "Enviar reseña"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:text-sand-100 dark:hover:bg-white/5"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (!mounted) return null;

  return createPortal(modal, document.body);
}
