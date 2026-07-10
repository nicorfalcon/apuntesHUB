"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  type DiscountType,
  formatDiscountLabel,
  normalizeCode,
  validateCouponForm,
} from "@/lib/coupons/discount";

export interface CouponRow {
  id: string;
  code: string;
  discount_type: DiscountType;
  value: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

interface CouponsManagerProps {
  userId: string;
  initialCoupons: CouponRow[];
}

function couponState(c: CouponRow): { label: string; tone: string } {
  if (!c.active) return { label: "Desactivado", tone: "text-gray-400" };
  if (c.expires_at && new Date(c.expires_at) <= new Date())
    return { label: "Expirado", tone: "text-amber-600" };
  if (c.max_uses !== null && c.used_count >= c.max_uses)
    return { label: "Agotado", tone: "text-amber-600" };
  return { label: "Activo", tone: "text-green-600" };
}

export function CouponsManager({ userId, initialCoupons }: CouponsManagerProps) {
  const [coupons, setCoupons] = useState<CouponRow[]>(initialCoupons);
  const [showForm, setShowForm] = useState(initialCoupons.length === 0);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [value, setValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setCode("");
    setDiscountType("percentage");
    setValue("");
    setMaxUses("");
    setExpiresAt("");
  }

  async function handleCreate() {
    const parsedValue = parseFloat(value);
    const parsedMaxUses = maxUses.trim() === "" ? null : parseInt(maxUses, 10);

    const validationError = validateCouponForm({
      code,
      discountType,
      value: parsedValue,
      maxUses: parsedMaxUses,
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("coupons")
      .insert({
        seller_id: userId,
        code: normalizeCode(code),
        discount_type: discountType,
        value: parsedValue,
        max_uses: parsedMaxUses,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      .select(
        "id, code, discount_type, value, max_uses, used_count, expires_at, active, created_at"
      )
      .single();

    setSaving(false);

    if (error) {
      toast.error(
        error.code === "23505"
          ? "Ya tenés un código con ese nombre."
          : "No se pudo crear el código."
      );
      return;
    }

    setCoupons((prev) => [data as CouponRow, ...prev]);
    resetForm();
    setShowForm(false);
    toast.success("Código creado.");
  }

  async function handleToggle(coupon: CouponRow) {
    const supabase = createClient();
    const { error } = await supabase
      .from("coupons")
      .update({ active: !coupon.active })
      .eq("id", coupon.id);

    if (error) {
      toast.error("No se pudo actualizar el código.");
      return;
    }
    setCoupons((prev) =>
      prev.map((c) => (c.id === coupon.id ? { ...c, active: !c.active } : c))
    );
  }

  async function handleDelete(coupon: CouponRow) {
    const supabase = createClient();
    const { error } = await supabase.from("coupons").delete().eq("id", coupon.id);
    if (error) {
      toast.error("No se pudo eliminar el código.");
      return;
    }
    setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
    toast.success("Código eliminado.");
  }

  return (
    <div className="space-y-8">
      {/* Formulario de creación */}
      {showForm ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <h2 className="text-sm font-semibold text-foreground">Nuevo código</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-gray-500 dark:text-sand-300/75">
              Código
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PARCIAL20"
                maxLength={20}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm uppercase tracking-wide outline-none focus:border-accent-400 dark:border-white/15 dark:bg-white/[0.03]"
              />
            </label>

            <label className="text-xs font-medium text-gray-500 dark:text-sand-300/75">
              Tipo de descuento
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-400 dark:border-white/15 dark:bg-white/[0.03]"
              >
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed">Monto fijo ($)</option>
              </select>
            </label>

            <label className="text-xs font-medium text-gray-500 dark:text-sand-300/75">
              {discountType === "percentage" ? "Porcentaje" : "Monto en $"}
              <input
                type="number"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={discountType === "percentage" ? "20" : "500"}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-400 dark:border-white/15 dark:bg-white/[0.03]"
              />
            </label>

            <label className="text-xs font-medium text-gray-500 dark:text-sand-300/75">
              Límite de usos (opcional)
              <input
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Sin límite"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-400 dark:border-white/15 dark:bg-white/[0.03]"
              />
            </label>

            <label className="text-xs font-medium text-gray-500 dark:text-sand-300/75">
              Vence (opcional)
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-400 dark:border-white/15 dark:bg-white/[0.03]"
              />
            </label>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
            >
              {saving ? "Creando…" : "Crear código"}
            </button>
            {coupons.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-lg border border-accent-600 px-4 py-2 text-sm font-semibold text-accent-700 hover:bg-accent-50 dark:border-accent-300/35 dark:text-accent-100 dark:hover:bg-accent-300/10"
        >
          + Nuevo código
        </button>
      )}

      {/* Lista */}
      {coupons.length === 0 ? (
        <p className="text-sm text-gray-400">Todavía no creaste ningún código.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-white/10">
          {coupons.map((c) => {
            const state = couponState(c);
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold tracking-wide text-foreground">
                      {c.code}
                    </span>
                    <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-700 dark:bg-accent-300/10 dark:text-accent-100">
                      {formatDiscountLabel({
                        discountType: c.discount_type,
                        value: c.value,
                      })}
                    </span>
                    <span className={`text-[11px] font-medium ${state.tone}`}>
                      {state.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {c.used_count}
                    {c.max_uses !== null ? ` / ${c.max_uses}` : ""} usos
                    {c.expires_at
                      ? ` · vence ${new Date(c.expires_at).toLocaleDateString("es-AR")}`
                      : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggle(c)}
                    className="font-medium text-accent-700 hover:underline dark:text-accent-100"
                  >
                    {c.active ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
