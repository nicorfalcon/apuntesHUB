"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const FOLDER_COLORS = [
  "#3b6558", // accent-600 (default)
  "#2563eb", // blue
  "#7c3aed", // violet
  "#dc2626", // red
  "#d97706", // amber
  "#059669", // emerald
  "#0891b2", // cyan
  "#6b7280", // gray
];

interface CreateFolderButtonProps {
  variant?: "default" | "ghost";
  className?: string;
}

export function CreateFolderButton({ variant = "default", className = "" }: CreateFolderButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Ingresá un nombre."); return; }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sesión expirada."); setLoading(false); return; }

    const { error: err } = await supabase.from("folders").insert({ user_id: user.id, name: name.trim(), color });
    if (err) { setError(err.message); setLoading(false); return; }

    setOpen(false);
    setName("");
    setColor(FOLDER_COLORS[0]);
    setLoading(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={variant === "ghost"
          ? `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-accent-600 hover:bg-accent-50 transition-colors ${className}`
          : `inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-700 ${className}`
        }
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Nueva carpeta
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-foreground">Nueva carpeta</h2>
            <p className="mt-1 text-sm text-gray-500">Organizá tus apuntes en carpetas temáticas.</p>

            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Cálculo II, Parciales 2025..."
                  maxLength={50}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-lg bg-accent-600 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
                >
                  {loading ? "Creando..." : "Crear carpeta"}
                </button>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setName(""); setError(null); }}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
