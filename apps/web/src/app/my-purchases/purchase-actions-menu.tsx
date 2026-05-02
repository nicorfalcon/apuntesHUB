"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FolderPlus, MoreVertical, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ReviewForm } from "@/components/resume/review-form";
import type { FolderWithItems } from "@/lib/database.types";

interface ExistingReview {
  id: string;
  rating: number;
  comment: string | null;
}

interface PurchaseActionsMenuProps {
  purchaseId: string;
  resumeId: string;
  sellerId: string;
  folders: FolderWithItems[];
  existingReview?: Pick<ExistingReview, "id">;
}

export function PurchaseActionsMenu({
  purchaseId,
  resumeId,
  sellerId,
  folders,
  existingReview,
}: PurchaseActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [fetchingReview, setFetchingReview] = useState(false);
  const [loadedReview, setLoadedReview] = useState<ExistingReview | undefined>(undefined);
  const [folderLoading, setFolderLoading] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const isInFolder = (folderId: string) =>
    folders.find((folder) => folder.id === folderId)?.folder_items?.some((item) => item.resume_id === resumeId) ?? false;

  async function openReview() {
    setOpen(false);
    if (existingReview) {
      setFetchingReview(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("reviews")
        .select("id, rating, comment")
        .eq("purchase_id", purchaseId)
        .single();
      setLoadedReview(data ?? undefined);
      setFetchingReview(false);
    } else {
      setLoadedReview(undefined);
    }
    setReviewOpen(true);
  }

  async function toggleFolder(folderId: string) {
    setFolderLoading(folderId);
    const supabase = createClient();
    if (isInFolder(folderId)) {
      await supabase.from("folder_items").delete().eq("folder_id", folderId).eq("resume_id", resumeId);
    } else {
      await supabase.from("folder_items").insert({ folder_id: folderId, resume_id: resumeId });
    }
    setFolderLoading(null);
    router.refresh();
  }

  return (
    <div className="relative" ref={menuRef} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Más acciones"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-foreground dark:border-white/10 dark:text-sand-300/70 dark:hover:bg-white/5 dark:hover:text-sand-50"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-20 mb-2 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg shadow-black/5 dark:border-white/10 dark:bg-[#071713] dark:shadow-black/35">
          <button
            type="button"
            onClick={openReview}
            disabled={fetchingReview}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:text-sand-100 dark:hover:bg-white/5"
          >
            <Star className="h-4 w-4 text-accent-600" />
            <span className="flex-1">{existingReview ? "Editar reseña" : "Reseñar"}</span>
            {fetchingReview && <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent-600 border-t-transparent" />}
          </button>

          <div className="my-1 border-t border-gray-100 dark:border-white/10" />

          {folders.length === 0 ? (
            <div className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-400 dark:text-sand-300/65">
              <FolderPlus className="h-4 w-4" />
              Sin carpetas creadas
            </div>
          ) : (
            folders.map((folder) => {
              const inFolder = isInFolder(folder.id);
              const isLoading = folderLoading === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => toggleFolder(folder.id)}
                  disabled={isLoading}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 disabled:opacity-60 dark:hover:bg-white/5"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: folder.color + "24" }}>
                    <FolderPlus className="h-4 w-4" style={{ color: folder.color }} />
                  </span>
                  <span className={`flex-1 truncate ${inFolder ? "font-medium text-accent-600 dark:text-accent-300" : "text-gray-700 dark:text-sand-100"}`}>{folder.name}</span>
                  {inFolder && <Check className="h-4 w-4 text-accent-600" />}
                  {isLoading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent-600 border-t-transparent" />}
                </button>
              );
            })
          )}
        </div>
      )}

      {reviewOpen && (
        <ReviewForm
          purchaseId={purchaseId}
          resumeId={resumeId}
          sellerId={sellerId}
          existingReview={loadedReview}
          onClose={() => {
            setReviewOpen(false);
            setLoadedReview(undefined);
          }}
        />
      )}
    </div>
  );
}
