"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDeleteResumeDialog } from "./confirm-delete-resume-dialog";

interface ResumeActionsMenuProps {
  resumeId: string;
  resumeTitle: string;
}

export function ResumeActionsMenu({ resumeId, resumeTitle }: ResumeActionsMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const focused = itemRefs.current.findIndex((el) => el === document.activeElement);
        const next = (focused + 1) % itemRefs.current.length;
        itemRefs.current[next]?.focus();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const focused = itemRefs.current.findIndex((el) => el === document.activeElement);
        const prev = (focused - 1 + itemRefs.current.length) % itemRefs.current.length;
        itemRefs.current[prev]?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => itemRefs.current[0]?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  function handleEdit() {
    setOpen(false);
    router.push(`/sell/${resumeId}/edit`);
  }

  function handleDeleteClick() {
    setOpen(false);
    setError(null);
    setConfirmOpen(true);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setError(null);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("resumes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", resumeId);

    if (dbError) {
      setError("No pudimos eliminar el apunte. Intentá de nuevo.");
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setConfirmOpen(false);
    router.refresh();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Opciones para ${resumeTitle}`}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-500"
      >
        <MoreVertical size={18} strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Opciones para ${resumeTitle}`}
          className="absolute right-0 z-50 mt-1 w-56 rounded-xl border border-gray-100 bg-white py-1 shadow-[0_4px_20px_rgba(0,0,0,0.10)]"
        >
          <button
            ref={(el) => { itemRefs.current[0] = el; }}
            role="menuitem"
            type="button"
            tabIndex={-1}
            onClick={handleEdit}
            className="flex w-full items-center px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
          >
            Editar apunte
          </button>
          <button
            ref={(el) => { itemRefs.current[1] = el; }}
            role="menuitem"
            type="button"
            tabIndex={-1}
            onClick={handleDeleteClick}
            className="flex w-full items-center px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 focus:bg-red-50 focus:outline-none"
          >
            Eliminar apunte
          </button>
        </div>
      )}

      <ConfirmDeleteResumeDialog
        open={confirmOpen}
        resumeTitle={resumeTitle}
        loading={deleting}
        error={error}
        onCancel={() => {
          if (!deleting) setConfirmOpen(false);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
