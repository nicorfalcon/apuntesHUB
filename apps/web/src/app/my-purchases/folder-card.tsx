"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { FolderWithItems } from "@/lib/database.types";

const FOLDER_COLORS = [
  "#3b6558","#2563eb","#7c3aed","#dc2626","#d97706","#059669","#0891b2","#6b7280",
];

interface FolderCardProps {
  folder: FolderWithItems;
}

export function FolderCard({ folder }: FolderCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [editColor, setEditColor] = useState(folder.color);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const count = folder.folder_items?.length ?? 0;

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("folders").update({ name: editName.trim(), color: editColor }).eq("id", folder.id);
    setLoading(false);
    setEditOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    setLoading(true);
    const supabase = createClient();
    await supabase.from("folders").delete().eq("id", folder.id);
    setLoading(false);
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
        {/* Menu contextual */}
        <div className="absolute right-2 top-2 z-10">
          <button
            onClick={(e) => { e.preventDefault(); setMenuOpen((v) => !v); }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 mt-1 w-40 rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => { setMenuOpen(false); setEditOpen(true); }}
                className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Editar
              </button>
              <button
                onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>
          )}
        </div>

        <Link href={`/my-purchases/folder/${folder.id}`} className="flex flex-col gap-3">
          {/* Icono carpeta */}
          <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: folder.color + "20" }}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={folder.color}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v8.25A2.25 2.25 0 004.5 16.5h15a2.25 2.25 0 002.25-2.25V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground line-clamp-1">{folder.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{count} {count === 1 ? "apunte" : "apuntes"}</p>
          </div>
        </Link>
      </div>

      {/* Modal editar */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={(e) => e.target === e.currentTarget && setEditOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-foreground">Editar carpeta</h2>
            <form onSubmit={handleEdit} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={50}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {FOLDER_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setEditColor(c)}
                      className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${editColor === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-accent-600 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-60">
                  {loading ? "Guardando..." : "Guardar"}
                </button>
                <button type="button" onClick={() => setEditOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={(e) => e.target === e.currentTarget && setDeleteOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-foreground">¿Eliminar carpeta?</h2>
            <p className="mt-2 text-sm text-gray-500">Se eliminará la carpeta <strong>&quot;{folder.name}&quot;</strong>. Los apuntes que contiene no se eliminan.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={handleDelete} disabled={loading} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {loading ? "Eliminando..." : "Eliminar"}
              </button>
              <button onClick={() => setDeleteOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
