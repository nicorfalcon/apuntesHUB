"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { FolderWithItems } from "@/lib/database.types";

interface AddToFolderMenuProps {
  resumeId: string;
  folders: FolderWithItems[];
}

export function AddToFolderMenu({ resumeId, folders }: AddToFolderMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
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
    folders.find((f) => f.id === folderId)?.folder_items?.some((fi) => fi.resume_id === resumeId) ?? false;

  async function toggleFolder(folderId: string) {
    setLoading(folderId);
    const supabase = createClient();
    if (isInFolder(folderId)) {
      await supabase.from("folder_items").delete().eq("folder_id", folderId).eq("resume_id", resumeId);
    } else {
      await supabase.from("folder_items").insert({ folder_id: folderId, resume_id: resumeId });
    }
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Agregar a carpeta"
        className="flex items-center justify-center rounded-lg border border-gray-200 p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-foreground dark:border-white/10 dark:text-sand-300/70 dark:hover:bg-white/5 dark:hover:text-sand-50"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-20 mb-2 w-52 rounded-xl border border-gray-100 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#071713]">
          {folders.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-sand-300/65">No tenés carpetas creadas</p>
          ) : (
            folders.map((folder) => {
              const inFolder = isInFolder(folder.id);
              const isLoading = loading === folder.id;
              return (
                <button
                  key={folder.id}
                  onClick={() => toggleFolder(folder.id)}
                  disabled={isLoading}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-60 dark:hover:bg-white/5"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded" style={{ backgroundColor: folder.color + "30" }}>
                    <svg className="h-3 w-3" fill={folder.color} viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                  </span>
                  <span className={`flex-1 truncate ${inFolder ? "font-medium text-accent-600 dark:text-accent-300" : "text-gray-700 dark:text-sand-100"}`}>{folder.name}</span>
                  {inFolder && (
                    <svg className="h-4 w-4 text-accent-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                  {isLoading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent-600 border-t-transparent" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
