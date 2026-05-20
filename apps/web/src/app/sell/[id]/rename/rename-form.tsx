"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const MAX_LENGTH = 80;

interface RenameFormProps {
  resumeId: string;
  resumeTitle: string;
  resumeSubject: string;
  resumeUniversity: string;
}

const inputClass =
  "mt-1 w-full rounded-[9px] border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-gray-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 dark:border-white/15 dark:bg-white/[0.04] dark:placeholder:text-sand-300/45 dark:focus:border-accent-300 dark:focus:ring-accent-300/15";

export function RenameForm({
  resumeId,
  resumeTitle,
  resumeSubject,
  resumeUniversity,
}: RenameFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(resumeTitle);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_LENGTH - title.length;
  const isOverLimit = remaining < 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = title.trim();
    if (!trimmed) {
      setError("El nombre no puede estar vacío.");
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setError(`El nombre no puede superar los ${MAX_LENGTH} caracteres.`);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("resumes")
      .update({ title: trimmed })
      .eq("id", resumeId);

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    toast.success("Nombre actualizado correctamente.");
    router.push("/sell/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Info card */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <h3 className="text-sm font-semibold text-foreground">{resumeTitle}</h3>
        <p className="mt-0.5 text-xs text-gray-400 dark:text-sand-300/65">
          {resumeSubject} · {resumeUniversity}
        </p>
      </div>

      {/* Title input */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between">
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-sand-100">
            Nombre del apunte
          </label>
          <span
            className={`text-xs tabular-nums ${
              isOverLimit ? "font-medium text-red-500 dark:text-red-300" : "text-gray-400 dark:text-sand-300/65"
            }`}
          >
            {title.length}/{MAX_LENGTH}
          </span>
        </div>
        <input
          id="title"
          type="text"
          required
          maxLength={MAX_LENGTH + 10}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${inputClass} ${isOverLimit ? "border-red-300 focus:border-red-400 focus:ring-red-400/20" : ""}`}
          placeholder="Ej: Resumen Derecho Constitucional — Unidad 3"
        />
        <p className="mt-1.5 text-xs text-gray-400 dark:text-sand-300/65">
          Usá un nombre descriptivo que ayude a los compradores a encontrar tu apunte.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-200">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/sell/dashboard")}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/15 dark:text-sand-100 dark:hover:bg-white/5"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || isOverLimit || !title.trim()}
          className="rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
        >
          {loading ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
