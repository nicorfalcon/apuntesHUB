"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface PriceFormProps {
  resumeId: string;
  resumeTitle: string;
  resumeSubject: string;
  resumeUniversity: string;
  currentPrice: number;
  currentStatus: string;
}

const inputClass =
  "mt-1 w-full rounded-[9px] border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20";

export function PriceForm({
  resumeId,
  resumeTitle,
  resumeSubject,
  resumeUniversity,
  currentPrice,
  currentStatus,
}: PriceFormProps) {
  const router = useRouter();
  const [price, setPrice] = useState(currentPrice.toString());
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function formatDisplay(value: string) {
    const num = parseFloat(value);
    if (isNaN(num)) return "";
    return num.toLocaleString("es-AR");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = parseFloat(price);
    if (isNaN(parsed) || parsed < 0) {
      setError("Ingresá un precio válido (mayor o igual a 0).");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("resumes")
      .update({ price: parsed, status })
      .eq("id", resumeId);

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    toast.success("Precio actualizado correctamente.");
    router.push("/sell/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Info card */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-foreground">{resumeTitle}</h3>
        <p className="mt-0.5 text-xs text-gray-400">
          {resumeSubject} · {resumeUniversity}
        </p>
      </div>

      {/* Price input */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <label htmlFor="price" className="block text-sm font-medium text-gray-700">
          Precio en pesos (ARS)
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium text-gray-500">
            $
          </span>
          <input
            id="price"
            type="number"
            min="0"
            step="1"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={`${inputClass} pl-7`}
            placeholder="0"
          />
        </div>
        {price && !isNaN(parseFloat(price)) && (
          <p className="mt-1.5 text-xs text-gray-400">
            Precio mostrado: <span className="font-medium text-gray-600">${formatDisplay(price)} ARS</span>
          </p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          Recibís el <span className="font-medium text-accent-700">80%</span> de cada venta. La plataforma retiene un 20% de comisión.
          Precio mínimo recomendado: $500 ARS. Podés publicar gratis ingresando 0.
        </p>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            Estado de la publicación
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            <option value="published">Publicado — visible para compradores</option>
            <option value="draft">Borrador — no visible</option>
            <option value="archived">Archivado — oculto temporalmente</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/sell/dashboard")}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
