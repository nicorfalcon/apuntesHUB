"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Resume } from "@/lib/database.types";

interface ResumeFormProps {
  userId: string;
  initial?: Resume;
}

export function ResumeForm({ userId, initial }: ResumeFormProps) {
  const router = useRouter();
  const isEdit = !!initial;

  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    subject: initial?.subject ?? "",
    university: initial?.university ?? "",
    career: initial?.career ?? "",
    price: initial?.price?.toString() ?? "",
    status: initial?.status ?? "draft",
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const resumeId = initial?.id ?? crypto.randomUUID();

    let fileUrl = initial?.file_url ?? null;
    let previewUrl = initial?.preview_url ?? null;

    // Subir PDF si se seleccionó
    if (pdfFile) {
      const path = `${userId}/${resumeId}/${pdfFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(path, pdfFile, { upsert: true });
      if (uploadError) {
        setError("Error al subir el PDF: " + uploadError.message);
        setLoading(false);
        return;
      }
      fileUrl = path;
    }

    // Subir preview si se seleccionó
    if (previewFile) {
      const path = `${userId}/${resumeId}/${previewFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("previews")
        .upload(path, previewFile, { upsert: true });
      if (uploadError) {
        setError("Error al subir la preview: " + uploadError.message);
        setLoading(false);
        return;
      }
      const { data: publicData } = supabase.storage.from("previews").getPublicUrl(path);
      previewUrl = publicData.publicUrl;
    }

    const payload = {
      id: resumeId,
      seller_id: userId,
      title: form.title,
      description: form.description || null,
      subject: form.subject,
      university: form.university,
      career: form.career,
      price: parseFloat(form.price),
      file_url: fileUrl,
      preview_url: previewUrl,
      status: form.status as Resume["status"],
    };

    let dbError;
    if (isEdit) {
      const { error } = await supabase
        .from("resumes")
        .update(payload)
        .eq("id", resumeId);
      dbError = error;
    } else {
      const { error } = await supabase.from("resumes").insert(payload);
      dbError = error;
    }

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    router.push("/sell/dashboard");
    router.refresh();
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20";
  const labelClass = "block text-sm font-medium text-gray-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="title" className={labelClass}>Título *</label>
        <input id="title" name="title" required value={form.title} onChange={handleChange} className={inputClass} placeholder="Resumen Derecho Constitucional — Unidad 3" />
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>Descripción</label>
        <textarea id="description" name="description" value={form.description} onChange={handleChange} rows={3} className={inputClass} placeholder="Descripción breve del contenido..." />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="subject" className={labelClass}>Materia *</label>
          <input id="subject" name="subject" required value={form.subject} onChange={handleChange} className={inputClass} placeholder="Derecho Constitucional" />
        </div>
        <div>
          <label htmlFor="university" className={labelClass}>Universidad *</label>
          <input id="university" name="university" required value={form.university} onChange={handleChange} className={inputClass} placeholder="UBA" />
        </div>
        <div>
          <label htmlFor="career" className={labelClass}>Carrera *</label>
          <input id="career" name="career" required value={form.career} onChange={handleChange} className={inputClass} placeholder="Abogacía" />
        </div>
        <div>
          <label htmlFor="price" className={labelClass}>Precio (ARS) *</label>
          <input id="price" name="price" type="number" min="0" step="0.01" required value={form.price} onChange={handleChange} className={inputClass} placeholder="850" />
        </div>
      </div>

      <div>
        <label htmlFor="status" className={labelClass}>Estado</label>
        <select id="status" name="status" value={form.status} onChange={handleChange} className={inputClass}>
          <option value="draft">Borrador (no visible)</option>
          <option value="published">Publicado</option>
          <option value="archived">Archivado</option>
        </select>
      </div>

      <div>
        <label htmlFor="pdf" className={labelClass}>
          Archivo PDF {!isEdit && "*"}
        </label>
        <input
          id="pdf"
          type="file"
          accept="application/pdf"
          required={!isEdit}
          onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-accent-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-700"
        />
        {isEdit && <p className="mt-1 text-xs text-gray-400">Dejá vacío para mantener el archivo actual.</p>}
      </div>

      <div>
        <label htmlFor="preview" className={labelClass}>Imagen de preview (opcional)</label>
        <input
          id="preview"
          type="file"
          accept="image/*"
          onChange={(e) => setPreviewFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-accent-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-700"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
        >
          {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Publicar apunte"}
        </button>
        <a
          href="/sell/dashboard"
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
