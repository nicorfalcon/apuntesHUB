"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { clampDiscountPercent, discountedPrice } from "@/lib/discounts/direct";

interface PriceFormProps {
  resumeId: string;
  resumeTitle: string;
  resumeSubject: string;
  resumeUniversity: string;
  currentPrice: number;
  currentStatus: string;
  currentDiscount: number;
}

const inputClass =
  "mt-1 w-full rounded-[9px] border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-gray-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 dark:border-white/15 dark:bg-white/[0.04] dark:placeholder:text-sand-300/45 dark:focus:border-accent-300 dark:focus:ring-accent-300/15";

export function PriceForm({
  resumeId,
  resumeTitle,
  resumeSubject,
  resumeUniversity,
  currentPrice,
  currentStatus,
  currentDiscount,
}: PriceFormProps) {
  const router = useRouter();
  const [price, setPrice] = useState(currentPrice.toString());
  const [status, setStatus] = useState(currentStatus);
  const [discount, setDiscount] = useState(String(currentDiscount || ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedPrice = parseFloat(price);
  const parsedDiscount = clampDiscountPercent(parseInt(discount, 10) || 0);
  const hasValidPrice = !isNaN(parsedPrice) && parsedPrice >= 0;
  const finalPrice = hasValidPrice
    ? discountedPrice(parsedPrice, parsedDiscount)
    : 0;

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

    const discountValue = parseInt(discount, 10) || 0;
    if (discountValue < 0 || discountValue > 90) {
      setError("El descuento debe estar entre 0 y 90%.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("resumes")
      .update({ price: parsed, status, discount_percent: discountValue })
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
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <h3 className="text-sm font-semibold text-foreground">{resumeTitle}</h3>
        <p className="mt-0.5 text-xs text-gray-400 dark:text-sand-300/65">
          {resumeSubject} · {resumeUniversity}
        </p>
      </div>

      {/* Price input */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
        <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-sand-100">
          Precio en pesos (ARS)
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium text-gray-500 dark:text-sand-300/70">
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
          <p className="mt-1.5 text-xs text-gray-400 dark:text-sand-300/65">
            Precio mostrado: <span className="font-medium text-gray-600 dark:text-sand-100">${formatDisplay(price)} ARS</span>
          </p>
        )}
        <p className="mt-2 text-xs text-gray-400 dark:text-sand-300/65">
          Recibís el <span className="font-medium text-accent-700 dark:text-accent-100">90%</span> de cada venta. La plataforma retiene un 10% de comisión.
          Precio mínimo recomendado: $500 ARS. Podés publicar gratis ingresando 0.
        </p>

        {/* Descuento directo */}
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-white/10">
          <label htmlFor="discount" className="block text-sm font-medium text-gray-700 dark:text-sand-100">
            Descuento directo (opcional)
          </label>
          <div className="relative mt-1">
            <input
              id="discount"
              type="number"
              min="0"
              max="90"
              step="1"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className={`${inputClass} pr-8`}
              placeholder="0"
            />
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm font-medium text-gray-500 dark:text-sand-300/70">
              %
            </span>
          </div>
          {parsedDiscount > 0 && hasValidPrice ? (
            <p className="mt-2 flex flex-wrap items-baseline gap-2 text-sm">
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
                -{parsedDiscount}%
              </span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                ${finalPrice.toLocaleString("es-AR")}
              </span>
              <span className="text-gray-400 line-through">
                ${parsedPrice.toLocaleString("es-AR")}
              </span>
              <span className="text-xs text-gray-400">precio final para el comprador</span>
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-400 dark:text-sand-300/65">
              Aplicá un descuento visible (sin código) que aparece destacado en Explorar.
              El descuento sale de tu parte; la comisión se calcula sobre el monto ya descontado.
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-white/10">
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-sand-100">
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
          disabled={loading}
          className="rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
        >
          {loading ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
