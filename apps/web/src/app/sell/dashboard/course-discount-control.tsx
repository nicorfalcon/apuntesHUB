"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { clampDiscountPercent, discountedPrice } from "@/lib/discounts/direct";

interface CourseDiscountControlProps {
  courseId: string;
  priceArs: number;
  initialDiscount: number;
}

export function CourseDiscountControl({
  courseId,
  priceArs,
  initialDiscount,
}: CourseDiscountControlProps) {
  const [editing, setEditing] = useState(false);
  const [discount, setDiscount] = useState(initialDiscount);
  const [draft, setDraft] = useState(String(initialDiscount || ""));
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = clampDiscountPercent(parseInt(draft, 10) || 0);
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("recorded_courses")
      .update({ discount_percent: value })
      .eq("id", courseId);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar el descuento.");
      return;
    }
    setDiscount(value);
    setEditing(false);
    toast.success(value > 0 ? `Descuento del ${value}% aplicado.` : "Descuento quitado.");
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2 dark:border-rose-400/30 dark:bg-rose-500/10">
        <p className="text-[11px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-300">
          Descuento %
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <input
            type="number"
            min="0"
            max="90"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            className="w-14 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-foreground outline-none focus:border-rose-400 dark:border-white/15 dark:bg-white/[0.06]"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {saving ? "…" : "OK"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(String(discount || ""));
              setEditing(false);
            }}
            className="text-xs text-gray-400 hover:text-foreground"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-left transition-colors hover:border-rose-300 hover:bg-rose-50/50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-rose-400/30 dark:hover:bg-rose-500/10"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        Descuento
      </p>
      {discount > 0 ? (
        <p className="mt-1 flex items-baseline gap-1.5 text-sm">
          <span className="rounded-full bg-rose-600 px-1.5 text-xs font-bold text-white">
            -{discount}%
          </span>
          <span className="font-bold text-rose-600 dark:text-rose-400">
            ${discountedPrice(priceArs, discount).toLocaleString("es-AR")}
          </span>
        </p>
      ) : (
        <p className="mt-1 text-sm font-semibold text-accent-700 dark:text-accent-100">
          Agregar
        </p>
      )}
    </button>
  );
}
