"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CourseReviewForm } from "./course-review-form";

interface CourseReviewButtonProps {
  enrollmentId: string;
  courseId: string;
  hasExistingReview: boolean;
}

interface ExistingReview {
  id: string;
  rating: number;
  comment: string | null;
}

export function CourseReviewButton({
  enrollmentId,
  courseId,
  hasExistingReview,
}: CourseReviewButtonProps) {
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [loadedReview, setLoadedReview] = useState<ExistingReview | undefined>();

  async function handleOpen() {
    if (hasExistingReview) {
      setFetching(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("course_reviews")
        .select("id, rating, comment")
        .eq("enrollment_id", enrollmentId)
        .single();
      setLoadedReview(data ?? undefined);
      setFetching(false);
    } else {
      setLoadedReview(undefined);
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={fetching}
        className="inline-flex items-center gap-2 rounded-xl border border-accent-200 px-4 py-2.5 text-sm font-bold text-accent-700 transition-colors hover:bg-accent-50 disabled:opacity-60 dark:border-accent-300/25 dark:text-accent-100 dark:hover:bg-accent-300/10"
      >
        {fetching
          ? "Cargando…"
          : hasExistingReview
          ? "Editar reseña"
          : "Dejar reseña"}
      </button>

      {open && (
        <CourseReviewForm
          enrollmentId={enrollmentId}
          courseId={courseId}
          existingReview={loadedReview}
          onClose={() => {
            setOpen(false);
            setLoadedReview(undefined);
          }}
        />
      )}
    </>
  );
}
