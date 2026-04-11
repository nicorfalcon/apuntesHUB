"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ReviewFormProps {
  purchaseId: string;
  resumeId: string;
  sellerId: string;
  onClose: () => void;
}

export function ReviewForm({ purchaseId, resumeId, sellerId, onClose }: ReviewFormProps) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError("Seleccioná una calificación."); return; }
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { setError("Sesión expirada. Recargá la página."); setLoading(false); return; }

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
      // Duplicate key = la reseña ya existe (primer submit funcionó pero la UI no se actualizó)
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
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-foreground">Dejar reseña</h2>
        <p className="mt-1 text-sm text-gray-500">Tu opinión ayuda a otros estudiantes a elegir mejor.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700">Calificación *</p>
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
                    className={`h-8 w-8 transition-colors ${star <= (hovered || rating) ? "text-amber-400" : "text-gray-200"}`}
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
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700">Comentario (opcional)</label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="¿Qué te pareció el apunte?"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-accent-600 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-60">
              {loading ? "Enviando..." : "Enviar reseña"}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
