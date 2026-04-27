"use client";

import { useState, useRef, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Resume } from "@/lib/database.types";
import { Upload, FileText, ImageIcon, Check } from "lucide-react";

interface ResumeFormProps {
  userId: string;
  initial?: Resume;
}

const STEPS = ["Información", "Archivo", "Precio"] as const;

export function ResumeForm({ userId, initial }: ResumeFormProps) {
  const router = useRouter();
  const isEdit = !!initial;

  const [currentStep, setCurrentStep] = useState(0);
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
  const [pdfDragActive, setPdfDragActive] = useState(false);
  const [previewDragActive, setPreviewDragActive] = useState(false);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Guardia: el submit sólo es válido en el último paso. Esto evita que
    // un cambio de type del botón ("button" → "submit") en plena
    // reconciliación de React dispare un envío al avanzar de paso.
    if (currentStep < STEPS.length - 1) return;

    setError(null);

    // Validar campos requeridos antes de enviar
    if (!form.title.trim() || !form.subject.trim() || !form.career.trim() || !form.university.trim()) {
      setError("Completá todos los campos obligatorios (título, materia, carrera y universidad).");
      setCurrentStep(0);
      return;
    }
    if (!isEdit && !pdfFile) {
      setError("Seleccioná un archivo PDF.");
      setCurrentStep(1);
      return;
    }
    if (!form.price && form.price !== "0") {
      setError("Ingresá un precio.");
      setCurrentStep(2);
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const resumeId = initial?.id ?? crypto.randomUUID();

    let fileUrl = initial?.file_url ?? null;
    let previewUrl = initial?.preview_url ?? null;

    // Subir PDF si se seleccionó
    if (pdfFile) {
      const path = `${userId}/${resumeId}/${pdfFile.name}`;
      const body = new FormData();
      body.append("file", pdfFile);
      body.append("bucket", "resumes");
      body.append("path", path);

      const res = await fetch("/api/upload", { method: "POST", body });
      const result = await res.json();
      if (!res.ok) {
        setError("Error al subir el PDF: " + result.error);
        setLoading(false);
        return;
      }
      fileUrl = result.path;
    }

    // Subir preview si se seleccionó
    if (previewFile) {
      const path = `${userId}/${resumeId}/${previewFile.name}`;
      const body = new FormData();
      body.append("file", previewFile);
      body.append("bucket", "previews");
      body.append("path", path);

      const res = await fetch("/api/upload", { method: "POST", body });
      const result = await res.json();
      if (!res.ok) {
        setError("Error al subir la preview: " + result.error);
        setLoading(false);
        return;
      }
      previewUrl = result.publicUrl;
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, seller_id: _seller_id, ...updatePayload } = payload;
      const { error } = await supabase
        .from("resumes")
        .update(updatePayload)
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

    toast.success(
      isEdit
        ? "Apunte actualizado correctamente."
        : "Apunte publicado correctamente."
    );
    router.push("/sell/dashboard");
    router.refresh();
  }

  /* ── Validation ── */
  function canAdvance(): boolean {
    // En modo edición los datos ya están cargados, permitir navegar libremente
    if (isEdit) return true;
    if (currentStep === 0) {
      return !!(
        form.title.trim() &&
        form.subject.trim() &&
        form.career.trim() &&
        form.university.trim()
      );
    }
    if (currentStep === 1) {
      return pdfFile !== null;
    }
    return true;
  }

  function nextStep() {
    if (canAdvance() && currentStep < 2) setCurrentStep((s) => s + 1);
  }
  function prevStep() {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  /* ── Drag & Drop helpers ── */
  function handleDrag(e: DragEvent, setActive: (v: boolean) => void) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setActive(true);
    if (e.type === "dragleave") setActive(false);
  }

  function handlePdfDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPdfDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type === "application/pdf") setPdfFile(file);
  }

  function handlePreviewDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPreviewDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) setPreviewFile(file);
  }

  /* ── Shared classes ── */
  const inputClass =
    "mt-1 w-full rounded-[9px] border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20";
  const labelClass = "block text-sm font-medium text-gray-700";

  /* ── Progress bar width ── */
  const progressPercent = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[0.5px] border-gray-200 bg-white"
    >
      {/* ── Progress indicator ── */}
      <div className="px-6 pt-6 pb-0 sm:px-8 sm:pt-8">
        {/* Dots + labels */}
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300 ${
                  i < currentStep
                    ? "bg-accent-600 text-white"
                    : i === currentStep
                      ? "bg-accent-600 text-white"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {i < currentStep ? (
                  <Check size={14} strokeWidth={3} />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors duration-300 ${
                  i <= currentStep ? "text-accent-600" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-accent-600 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ── Step content ── */}
      <div className="px-6 py-6 sm:px-8">
        {/* Step 1 — Información */}
        <div
          className={`transition-opacity duration-300 ${currentStep === 0 ? "block" : "hidden"}`}
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className={labelClass}>
                Título *
              </label>
              <input
                id="title"
                name="title"
                required
                value={form.title}
                onChange={handleChange}
                className={inputClass}
                placeholder="Resumen Derecho Constitucional — Unidad 3"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="subject" className={labelClass}>
                  Materia *
                </label>
                <input
                  id="subject"
                  name="subject"
                  required
                  value={form.subject}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Derecho Constitucional"
                />
              </div>
              <div>
                <label htmlFor="career" className={labelClass}>
                  Carrera *
                </label>
                <input
                  id="career"
                  name="career"
                  required
                  value={form.career}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Abogacía"
                />
              </div>
            </div>

            <div>
              <label htmlFor="university" className={labelClass}>
                Universidad *
              </label>
              <input
                id="university"
                name="university"
                required
                value={form.university}
                onChange={handleChange}
                className={inputClass}
                placeholder="UBA"
              />
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>
                Descripción{" "}
                <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                className={inputClass}
                placeholder="Descripción breve del contenido..."
              />
            </div>
          </div>
        </div>

        {/* Step 2 — Archivo */}
        <div
          className={`transition-opacity duration-300 ${currentStep === 1 ? "block" : "hidden"}`}
        >
          <div className="space-y-5">
            {/* PDF drop zone */}
            <div>
              <label className={labelClass}>
                Archivo PDF {!isEdit && "*"}
              </label>
              <div
                onDragEnter={(e) => handleDrag(e, setPdfDragActive)}
                onDragOver={(e) => handleDrag(e, setPdfDragActive)}
                onDragLeave={(e) => handleDrag(e, setPdfDragActive)}
                onDrop={handlePdfDrop}
                onClick={() => pdfInputRef.current?.click()}
                className={`mt-1 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors duration-200 ${
                  pdfDragActive
                    ? "border-accent-500 bg-accent-50"
                    : pdfFile
                      ? "border-accent-300 bg-accent-50"
                      : "border-gray-300 bg-gray-50 hover:border-accent-400 hover:bg-accent-50"
                }`}
              >
                {pdfFile ? (
                  <>
                    <FileText
                      size={32}
                      className="text-accent-600"
                      strokeWidth={1.5}
                    />
                    <p className="mt-2 text-sm font-medium text-gray-800">
                      {pdfFile.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB — Hacé click
                      para cambiar
                    </p>
                  </>
                ) : (
                  <>
                    <Upload
                      size={32}
                      className="text-gray-400"
                      strokeWidth={1.5}
                    />
                    <p className="mt-2 text-sm font-medium text-gray-600">
                      Arrastrá tu PDF acá o hacé click para seleccionar
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Solo archivos PDF
                    </p>
                  </>
                )}
                <input
                  ref={pdfInputRef}
                  id="pdf"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {isEdit && !pdfFile && (
                <p className="mt-1.5 text-xs text-gray-400">
                  Dejá vacío para mantener el archivo actual.
                </p>
              )}
            </div>

            {/* Preview image drop zone */}
            <div>
              <label className={labelClass}>
                Imagen de preview{" "}
                <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <div
                onDragEnter={(e) =>
                  handleDrag(e, setPreviewDragActive)
                }
                onDragOver={(e) =>
                  handleDrag(e, setPreviewDragActive)
                }
                onDragLeave={(e) =>
                  handleDrag(e, setPreviewDragActive)
                }
                onDrop={handlePreviewDrop}
                onClick={() => previewInputRef.current?.click()}
                className={`mt-1 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors duration-200 ${
                  previewDragActive
                    ? "border-accent-500 bg-accent-50"
                    : previewFile
                      ? "border-accent-300 bg-accent-50"
                      : "border-gray-300 bg-gray-50 hover:border-accent-400 hover:bg-accent-50"
                }`}
              >
                {previewFile ? (
                  <>
                    <ImageIcon
                      size={24}
                      className="text-accent-600"
                      strokeWidth={1.5}
                    />
                    <p className="mt-1.5 text-sm font-medium text-gray-800">
                      {previewFile.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Hacé click para cambiar
                    </p>
                  </>
                ) : (
                  <>
                    <ImageIcon
                      size={24}
                      className="text-gray-400"
                      strokeWidth={1.5}
                    />
                    <p className="mt-1.5 text-sm text-gray-500">
                      Arrastrá una imagen o hacé click para seleccionar
                    </p>
                  </>
                )}
                <input
                  ref={previewInputRef}
                  id="preview"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    setPreviewFile(e.target.files?.[0] ?? null)
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 — Precio */}
        <div
          className={`transition-opacity duration-300 ${currentStep === 2 ? "block" : "hidden"}`}
        >
          <div className="space-y-5">
            {/* Price input */}
            <div>
              <label htmlFor="price" className={labelClass}>
                Precio *
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium text-gray-500">
                  ARS
                </span>
                <input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={handleChange}
                  className={`${inputClass} pl-12`}
                  placeholder="850"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, price: "0" }))
                }
                className="mt-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-accent-500 hover:text-accent-600"
              >
                Gratuito
              </button>
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className={labelClass}>
                Estado
              </label>
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="draft">Borrador (no visible)</option>
                <option value="published">Publicado</option>
                <option value="archived">Archivado</option>
              </select>
            </div>

            {/* Summary card */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Resumen
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Título</dt>
                  <dd className="max-w-[60%] truncate text-right font-medium text-gray-800">
                    {form.title || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Materia</dt>
                  <dd className="font-medium text-gray-800">
                    {form.subject || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Universidad</dt>
                  <dd className="font-medium text-gray-800">
                    {form.university || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Archivo</dt>
                  <dd className="max-w-[60%] truncate text-right font-medium text-gray-800">
                    {pdfFile?.name ?? (isEdit ? "Archivo actual" : "—")}
                  </dd>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between">
                  <dt className="text-gray-500">Precio</dt>
                  <dd className="font-semibold text-accent-600">
                    {form.price === "0"
                      ? "Gratuito"
                      : form.price
                        ? `ARS ${form.price}`
                        : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="px-6 sm:px-8">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        </div>
      )}

      {/* ── Footer: navigation + step counter ── */}
      <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 sm:px-8">
        <span className="text-xs text-gray-400">
          Paso {currentStep + 1} de {STEPS.length}
        </span>

        <div className="flex items-center gap-3">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={prevStep}
              className="px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
            >
              Volver
            </button>
          )}

          {currentStep < 2 ? (
            <button
              key="step-next"
              type="button"
              onClick={nextStep}
              disabled={!canAdvance()}
              className="rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuar
            </button>
          ) : (
            <button
              key="step-submit"
              type="submit"
              disabled={loading || !form.price}
              className="rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading
                ? "Guardando..."
                : isEdit
                  ? "Guardar cambios"
                  : "Publicar apunte"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
