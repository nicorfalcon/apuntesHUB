"use client";

import { useState, useRef, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Resume } from "@/lib/database.types";
import {
  normalizeResumeTopic,
  normalizeResumeTopics,
  resumeTopicKey,
  MAX_RESUME_TOPICS,
  MAX_RESUME_TOPIC_LENGTH,
} from "@/lib/resumes/topics";
import { Upload, FileText, ImageIcon, Check, X } from "lucide-react";

interface ResumeFormProps {
  userId: string;
  initial?: Resume;
}

const STEPS = ["Información", "Archivo", "Precio"] as const;

export async function reindexResumeBestEffort(resumeId: string) {
  try {
    const response = await fetch("/api/admin/search/reindex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId }),
    });

    if (!response.ok) {
      console.warn("[resume-form] search reindex skipped", {
        resumeId,
        status: response.status,
      });
    }
  } catch (err) {
    console.warn("[resume-form] search reindex failed", {
      resumeId,
      message: err instanceof Error ? err.message : "unknown error",
    });
  }
}

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
  // "Temas del apunte": chips editables que mejoran la busqueda publica.
  const [topics, setTopics] = useState<string[]>(() =>
    normalizeResumeTopics(initial?.topics ?? [])
  );
  const [topicInput, setTopicInput] = useState("");
  const [topicError, setTopicError] = useState<string | null>(null);
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

  /* ── Temas del apunte (chips) ── */
  // Agrega uno o varios temas (el input permite separar por coma). Valida largo
  // y tope de cantidad mostrando un mensaje inline; deduplica contra los actuales.
  function commitTopics(rawValue: string) {
    const parts = rawValue
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;

    let next = [...topics];
    let error: string | null = null;
    const existingKeys = new Set(next.map(resumeTopicKey));

    for (const part of parts) {
      if (next.length >= MAX_RESUME_TOPICS) {
        error = `Máximo ${MAX_RESUME_TOPICS} temas.`;
        break;
      }
      if (part.length > MAX_RESUME_TOPIC_LENGTH) {
        error = `Cada tema puede tener hasta ${MAX_RESUME_TOPIC_LENGTH} caracteres.`;
        continue;
      }
      const normalized = normalizeResumeTopic(part);
      if (!normalized) continue;
      const key = resumeTopicKey(normalized);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      next = [...next, normalized];
    }

    setTopics(normalizeResumeTopics(next));
    setTopicInput("");
    setTopicError(error);
  }

  function handleTopicKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitTopics(topicInput);
    } else if (e.key === "Backspace" && topicInput === "" && topics.length > 0) {
      // Backspace con input vacío borra el último chip (UX típica de tags).
      setTopics((prev) => prev.slice(0, -1));
      setTopicError(null);
    }
  }

  function removeTopic(index: number) {
    setTopics((prev) => prev.filter((_, i) => i !== index));
    setTopicError(null);
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

    async function uploadDirect(file: File, bucket: "resumes" | "previews") {
      const path = `${userId}/${resumeId}/${file.name}`;

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket, path }),
      });
      const meta = await res.json();
      if (!res.ok) throw new Error(meta.error ?? "No se pudo iniciar la subida");

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(meta.path, meta.token, file, { upsert: true });
      if (upErr) throw new Error(upErr.message);

      return { path: meta.path as string, publicUrl: meta.publicUrl as string | null };
    }

    // Subir PDF si se seleccionó
    if (pdfFile) {
      try {
        const result = await uploadDirect(pdfFile, "resumes");
        fileUrl = result.path;
      } catch (err) {
        setError("Error al subir el PDF: " + (err as Error).message);
        setLoading(false);
        return;
      }
    }

    // Subir preview si se seleccionó
    if (previewFile) {
      try {
        const result = await uploadDirect(previewFile, "previews");
        previewUrl = result.publicUrl;
      } catch (err) {
        setError("Error al subir la preview: " + (err as Error).message);
        setLoading(false);
        return;
      }
    }

    // Normalizamos también el draft del input que el vendedor no haya confirmado
    // con Enter/coma, para no perder un tema recién tipeado al guardar.
    // DEUDA: esta validación es client-side (el guardado va directo a Supabase
    // vía RLS). Si en el futuro se agrega un endpoint/server action de guardado,
    // re-normalizar con normalizeResumeTopics ahí. Defensa en profundidad: el
    // indexado en Meilisearch ya re-normaliza topics (ver buildResumeDocument).
    const finalTopics = normalizeResumeTopics([
      ...topics,
      ...topicInput.split(","),
    ]);

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
      topics: finalTopics,
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

    // Best-effort: reindexar en Meilisearch para que los topics (y el resto de
    // metadata) queden actualizados en la búsqueda pública. El endpoint autoriza
    // al seller dueño, revalida published/deleted y es no-op si Meili no está
    // configurado. Nunca bloquea ni rompe el guardado.
    void reindexResumeBestEffort(resumeId);

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
    "mt-1 w-full rounded-xl border border-gray-200 bg-[var(--surface-warm)] px-3.5 py-2.5 text-sm text-foreground outline-none transition-[background-color,border-color,box-shadow] placeholder:text-gray-400 focus:border-accent-400 focus:bg-white focus:ring-2 focus:ring-accent-200/45 dark:border-white/15 dark:bg-white/[0.04] dark:placeholder:text-sand-300/45 dark:focus:border-accent-300 dark:focus:bg-white/[0.07] dark:focus:ring-accent-300/15";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-sand-100";

  /* ── Progress bar width ── */
  const progressPercent = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-white/[0.03]"
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
                      : "bg-gray-100 text-gray-400 dark:bg-white/[0.06] dark:text-sand-300/55"
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
                  i <= currentStep ? "text-accent-600 dark:text-accent-100" : "text-gray-400 dark:text-sand-300/55"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-accent-600 transition-[width] duration-500 ease-out"
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
                placeholder="Descripción breve del contenido…"
              />
            </div>

            {/* Temas del apunte (chips) */}
            <div>
              <label htmlFor="topic-input" className={labelClass}>
                Temas del apunte{" "}
                <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-sand-300/65">
                Agregá conceptos importantes que cubre el apunte. Esto ayuda a que
                otros estudiantes lo encuentren aunque busquen con otras palabras.
              </p>
              <div
                className={`mt-1.5 flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-[var(--surface-warm)] px-2.5 py-2 transition-[background-color,border-color,box-shadow] focus-within:border-accent-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-accent-200/45 dark:border-white/15 dark:bg-white/[0.04] dark:focus-within:border-accent-300 dark:focus-within:bg-white/[0.07] dark:focus-within:ring-accent-300/15`}
              >
                {topics.map((topic, i) => (
                  <span
                    key={`${resumeTopicKey(topic)}-${i}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-accent-100 px-2 py-1 text-xs font-medium text-accent-700 dark:bg-accent-300/15 dark:text-accent-100"
                  >
                    {topic}
                    <button
                      type="button"
                      onClick={() => removeTopic(i)}
                      aria-label={`Quitar tema ${topic}`}
                      className="rounded p-0.5 transition-colors hover:bg-accent-200/60 dark:hover:bg-accent-300/25"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
                <input
                  id="topic-input"
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={handleTopicKeyDown}
                  onBlur={() => commitTopics(topicInput)}
                  disabled={topics.length >= MAX_RESUME_TOPICS}
                  className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-gray-400 disabled:cursor-not-allowed dark:placeholder:text-sand-300/45"
                  placeholder={
                    topics.length >= MAX_RESUME_TOPICS
                      ? "Llegaste al máximo de temas"
                      : "Le Chatelier, equilibrio químico…"
                  }
                />
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span
                  className={`text-xs ${
                    topicError
                      ? "text-red-500 dark:text-red-300"
                      : "text-gray-400 dark:text-sand-300/65"
                  }`}
                >
                  {topicError ??
                    "Enter o coma para agregar cada tema."}
                </span>
                <span className="text-xs tabular-nums text-gray-400 dark:text-sand-300/65">
                  {topics.length}/{MAX_RESUME_TOPICS}
                </span>
              </div>
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
              <label
                htmlFor="pdf"
                onDragEnter={(e) => handleDrag(e, setPdfDragActive)}
                onDragOver={(e) => handleDrag(e, setPdfDragActive)}
                onDragLeave={(e) => handleDrag(e, setPdfDragActive)}
                onDrop={handlePdfDrop}
                className={`mt-1 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors duration-200 ${
                  pdfDragActive
                    ? "border-accent-500 bg-accent-50 dark:bg-accent-300/10"
                    : pdfFile
                      ? "border-accent-300 bg-accent-50 dark:bg-accent-300/10"
                      : "border-gray-300 bg-gray-50 hover:border-accent-400 hover:bg-accent-50 dark:border-white/15 dark:bg-white/[0.04] dark:hover:border-accent-300/40 dark:hover:bg-accent-300/10"
                }`}
              >
                {pdfFile ? (
                  <>
                    <FileText
                      size={32}
                      className="text-accent-600"
                      strokeWidth={1.5}
                    />
                    <p className="mt-2 text-sm font-medium text-gray-800 dark:text-sand-50">
                      {pdfFile.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-sand-300/65">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB, hacé click
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
                    <p className="mt-2 text-sm font-medium text-gray-600 dark:text-sand-100">
                      Arrastrá tu PDF acá o hacé click para seleccionar
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-sand-300/65">
                      Solo archivos PDF
                    </p>
                  </>
                )}
                <input
                  ref={pdfInputRef}
                  id="pdf"
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {isEdit && !pdfFile && (
                <p className="mt-1.5 text-xs text-gray-400 dark:text-sand-300/65">
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
              <label
                htmlFor="preview"
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
                className={`mt-1 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors duration-200 ${
                  previewDragActive
                    ? "border-accent-500 bg-accent-50 dark:bg-accent-300/10"
                    : previewFile
                      ? "border-accent-300 bg-accent-50 dark:bg-accent-300/10"
                      : "border-gray-300 bg-gray-50 hover:border-accent-400 hover:bg-accent-50 dark:border-white/15 dark:bg-white/[0.04] dark:hover:border-accent-300/40 dark:hover:bg-accent-300/10"
                }`}
              >
                {previewFile ? (
                  <>
                    <ImageIcon
                      size={24}
                      className="text-accent-600"
                      strokeWidth={1.5}
                    />
                    <p className="mt-1.5 text-sm font-medium text-gray-800 dark:text-sand-50">
                      {previewFile.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-sand-300/65">
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
                    <p className="mt-1.5 text-sm text-gray-500 dark:text-sand-300/75">
                      Arrastrá una imagen o hacé click para seleccionar
                    </p>
                  </>
                )}
                <input
                  ref={previewInputRef}
                  id="preview"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) =>
                    setPreviewFile(e.target.files?.[0] ?? null)
                  }
                />
              </label>
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
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium text-gray-500 dark:text-sand-300/75">
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
                className="mt-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-accent-500 hover:text-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30 dark:border-white/10 dark:text-sand-300/75 dark:hover:border-accent-300/35 dark:hover:text-accent-100"
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
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-sand-300/65">
                Resumen
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-sand-300/75">Título</dt>
                  <dd className="max-w-[60%] truncate text-right font-medium text-gray-800 dark:text-sand-50">
                    {form.title || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-sand-300/75">Materia</dt>
                  <dd className="font-medium text-gray-800 dark:text-sand-50">
                    {form.subject || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-sand-300/75">Universidad</dt>
                  <dd className="font-medium text-gray-800 dark:text-sand-50">
                    {form.university || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-sand-300/75">Archivo</dt>
                  <dd className="max-w-[60%] truncate text-right font-medium text-gray-800 dark:text-sand-50">
                    {pdfFile?.name ?? (isEdit ? "Archivo actual" : "—")}
                  </dd>
                </div>
                <div className="h-px bg-gray-200 dark:bg-white/10" />
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-sand-300/75">Precio</dt>
                  <dd className="font-semibold text-accent-600 dark:text-accent-100">
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
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-100">
            {error}
          </p>
        </div>
      )}

      {/* ── Footer: navigation + step counter ── */}
      <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 dark:border-white/10 sm:px-8">
        <span className="text-xs text-gray-400 dark:text-sand-300/65">
          Paso {currentStep + 1} de {STEPS.length}
        </span>

        <div className="flex items-center gap-3">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={prevStep}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30 dark:text-sand-300/70 dark:hover:bg-white/10 dark:hover:text-sand-50 dark:focus-visible:ring-accent-300/25"
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
              className="rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
            >
              Continuar
            </button>
          ) : (
            <button
              key="step-submit"
              type="submit"
              disabled={loading || !form.price}
              className="rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
            >
              {loading
                ? "Guardando…"
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
