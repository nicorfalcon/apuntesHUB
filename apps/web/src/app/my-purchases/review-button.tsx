"use client";

import { useState } from "react";
import { ReviewForm } from "@/components/resume/review-form";

interface ReviewButtonProps {
  purchaseId: string;
  resumeId: string;
  sellerId: string;
}

export function ReviewButton({ purchaseId, resumeId, sellerId }: ReviewButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-accent-200 px-3 py-2 text-xs font-medium text-accent-600 transition-colors hover:bg-accent-50"
      >
        Reseñar
      </button>
      {open && (
        <ReviewForm
          purchaseId={purchaseId}
          resumeId={resumeId}
          sellerId={sellerId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
