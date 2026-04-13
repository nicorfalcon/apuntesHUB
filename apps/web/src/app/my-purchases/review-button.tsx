"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ReviewForm } from "@/components/resume/review-form";

interface ExistingReview {
  id: string;
  rating: number;
  comment: string | null;
}

interface ReviewButtonProps {
  purchaseId: string;
  resumeId: string;
  sellerId: string;
  // Solo necesitamos saber si ya existe una reseña para el label del botón.
  // Los datos reales se fetchean frescos al abrir el form.
  existingReview?: Pick<ExistingReview, "id">;
}

export function ReviewButton({ purchaseId, resumeId, sellerId, existingReview }: ReviewButtonProps) {
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [loadedReview, setLoadedReview] = useState<ExistingReview | undefined>(undefined);

  const isReviewed = !!existingReview;

  async function handleOpen() {
    if (isReviewed) {
      // Siempre fetcheamos la reseña fresca antes de abrir el form de edición
      setFetching(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("reviews")
        .select("id, rating, comment")
        .eq("purchase_id", purchaseId)
        .single();
      setLoadedReview(data ?? undefined);
      setFetching(false);
    } else {
      setLoadedReview(undefined);
    }
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setLoadedReview(undefined);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={fetching}
        className="rounded-lg border border-accent-200 px-3 py-2 text-xs font-medium text-accent-600 transition-colors hover:bg-accent-50 disabled:opacity-60"
      >
        {fetching ? "Cargando..." : isReviewed ? "Editar reseña" : "Reseñar"}
      </button>

      {open && (
        <ReviewForm
          purchaseId={purchaseId}
          resumeId={resumeId}
          sellerId={sellerId}
          existingReview={loadedReview}
          onClose={handleClose}
        />
      )}
    </>
  );
}
