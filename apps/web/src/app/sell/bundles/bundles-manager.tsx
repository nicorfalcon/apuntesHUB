"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  sumResumePrices,
  bundleSavings,
  validateBundleForm,
} from "@/lib/bundles/pricing";

export interface SellerResume {
  id: string;
  title: string;
  subject: string;
  price: number;
}

export interface BundleRow {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  price: number;
  is_published: boolean;
  created_at: string;
  bundle_items: { resume_id: string }[];
}

interface BundlesManagerProps {
  initialBundles: BundleRow[];
  sellerResumes: SellerResume[];
}

export function BundlesManager({
  initialBundles,
  sellerResumes,
}: BundlesManagerProps) {
  const [bundles, setBundles] = useState<BundleRow[]>(initialBundles);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [price, setPrice] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const priceByResume = useMemo(() => {
    const m = new Map<string, number>();
    sellerResumes.forEach((r) => m.set(r.id, Number(r.price)));
    return m;
  }, [sellerResumes]);

  const individualTotal = useMemo(
    () => sumResumePrices([...selected].map((id) => priceByResume.get(id) ?? 0)),
    [selected, priceByResume]
  );
  const savings = bundleSavings(parseFloat(price) || 0, individualTotal);

  function resetForm() {
    setTitle("");
    setDescription("");
    setSubject("");
    setPrice("");
    setSelected(new Set());
    setEditingId(null);
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(b: BundleRow) {
    setEditingId(b.id);
    setTitle(b.title);
    setDescription(b.description ?? "");
    setSubject(b.subject ?? "");
    setPrice(String(b.price));
    setSelected(new Set(b.bundle_items.map((i) => i.resume_id)));
    setShowForm(true);
  }

  function toggleResume(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    const resumeIds = [...selected];
    const parsedPrice = parseFloat(price);
    const validationError = validateBundleForm({
      title,
      price: parsedPrice,
      resumeIds,
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const args = {
      p_title: title.trim(),
      p_description: description.trim() || null,
      p_subject: subject.trim() || null,
      p_price: parsedPrice,
      p_resume_ids: resumeIds,
    };

    if (editingId) {
      const { error } = await supabase.rpc("update_bundle", {
        p_bundle_id: editingId,
        ...args,
      });
      setSaving(false);
      if (error) {
        toast.error("No se pudo guardar el paquete.");
        return;
      }
      setBundles((prev) =>
        prev.map((b) =>
          b.id === editingId
            ? {
                ...b,
                title: args.p_title,
                description: args.p_description,
                subject: args.p_subject,
                price: parsedPrice,
                bundle_items: resumeIds.map((rid) => ({ resume_id: rid })),
              }
            : b
        )
      );
      toast.success("Paquete actualizado.");
    } else {
      const { data, error } = await supabase.rpc("create_bundle", args);
      setSaving(false);
      if (error || !data) {
        toast.error("No se pudo crear el paquete.");
        return;
      }
      const bundleId = (data as { bundle_id: string }).bundle_id;
      setBundles((prev) => [
        {
          id: bundleId,
          title: args.p_title,
          description: args.p_description,
          subject: args.p_subject,
          price: parsedPrice,
          is_published: false,
          created_at: new Date().toISOString(),
          bundle_items: resumeIds.map((rid) => ({ resume_id: rid })),
        },
        ...prev,
      ]);
      toast.success("Paquete creado. Publicalo para que aparezca a la venta.");
    }

    resetForm();
    setShowForm(false);
  }

  async function togglePublish(b: BundleRow) {
    const supabase = createClient();
    const { error } = await supabase
      .from("bundles")
      .update({ is_published: !b.is_published })
      .eq("id", b.id);
    if (error) {
      toast.error("No se pudo actualizar el paquete.");
      return;
    }
    setBundles((prev) =>
      prev.map((x) => (x.id === b.id ? { ...x, is_published: !x.is_published } : x))
    );
  }

  async function handleDelete(b: BundleRow) {
    const supabase = createClient();
    const { error } = await supabase
      .from("bundles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) {
      toast.error("No se pudo eliminar el paquete.");
      return;
    }
    setBundles((prev) => prev.filter((x) => x.id !== b.id));
    toast.success("Paquete eliminado.");
  }

  if (sellerResumes.length < 2) {
    return (
      <p className="rounded-xl border border-gray-100 bg-gray-50/70 p-5 text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.03]">
        Necesitás al menos 2 apuntes publicados para armar un paquete.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {showForm ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <h2 className="text-sm font-semibold text-foreground">
            {editingId ? "Editar paquete" : "Nuevo paquete"}
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-gray-500 dark:text-sand-300/75">
              Título
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Pack Análisis Matemático I"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-400 dark:border-white/15 dark:bg-white/[0.03]"
              />
            </label>
            <label className="text-xs font-medium text-gray-500 dark:text-sand-300/75">
              Materia (opcional)
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Análisis I"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-400 dark:border-white/15 dark:bg-white/[0.03]"
              />
            </label>
            <label className="text-xs font-medium text-gray-500 dark:text-sand-300/75 sm:col-span-2">
              Descripción (opcional)
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Todos los apuntes de la cursada"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-400 dark:border-white/15 dark:bg-white/[0.03]"
              />
            </label>
            <label className="text-xs font-medium text-gray-500 dark:text-sand-300/75">
              Precio del pack ($)
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1500"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-400 dark:border-white/15 dark:bg-white/[0.03]"
              />
            </label>
          </div>

          <div className="mt-5">
            <p className="text-xs font-medium text-gray-500 dark:text-sand-300/75">
              Apuntes incluidos ({selected.size})
            </p>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-100 bg-white p-2 dark:border-white/10 dark:bg-white/[0.02]">
              {sellerResumes.map((r) => (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleResume(r.id)}
                      className="h-4 w-4 accent-accent-600"
                    />
                    <span className="flex-1 truncate text-sm text-foreground">
                      {r.title}
                    </span>
                    <span className="text-xs text-gray-400">
                      ${Number(r.price).toLocaleString("es-AR")}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {selected.size > 0 && (
            <p className="mt-3 text-xs text-gray-500 dark:text-sand-300/75">
              Por separado:{" "}
              <span className="font-medium">
                ${individualTotal.toLocaleString("es-AR")}
              </span>
              {savings > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-green-700 dark:text-green-300">
                    ahorro de ${savings.toLocaleString("es-AR")}
                  </span>
                </>
              )}
            </p>
          )}

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
            >
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear paquete"}
            </button>
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
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startCreate}
          className="rounded-lg border border-accent-600 px-4 py-2 text-sm font-semibold text-accent-700 hover:bg-accent-50 dark:border-accent-300/35 dark:text-accent-100 dark:hover:bg-accent-300/10"
        >
          + Nuevo paquete
        </button>
      )}

      {bundles.length === 0 ? (
        <p className="text-sm text-gray-400">Todavía no armaste ningún paquete.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-white/10">
          {bundles.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {b.title}
                  </span>
                  <span
                    className={`text-[11px] font-medium ${b.is_published ? "text-green-600" : "text-gray-400"}`}
                  >
                    {b.is_published ? "Publicado" : "Borrador"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-400">
                  {b.bundle_items.length} apuntes · $
                  {Number(b.price).toLocaleString("es-AR")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => startEdit(b)}
                  className="font-medium text-gray-500 hover:text-foreground"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => togglePublish(b)}
                  className="font-medium text-accent-700 hover:underline dark:text-accent-100"
                >
                  {b.is_published ? "Despublicar" : "Publicar"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(b)}
                  className="text-gray-400 hover:text-red-600"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
