"use client";

import { useState, useRef, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { FileText, Upload, ImageIcon, X, Star } from "lucide-react";

const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX_MB = 5;
const PDF_MAX_MB = 25;

interface PhotosFormProps {
  resumeId: string;
  userId: string;
  resumeTitle: string;
  resumeSubject: string;
  resumeUniversity: string;
  currentPreviewUrl: string | null;
  currentFileUrl: string | null;
}

export function PhotosForm({
  resumeId,
  userId,
  resumeTitle,
  resumeSubject,
  resumeUniversity,
  currentPreviewUrl,
  currentFileUrl,
}: PhotosFormProps) {
  const router = useRouter();

  // Estado de la foto existente: si el usuario la "elimina" la marcamos como null
  const [existingUrl, setExistingUrl] = useState<string | null>(currentPreviewUrl);
  // Nueva foto a subir
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newPreview, setNewPreview] = useState<string | null>(null);
  const [newPdfFile, setNewPdfFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pdfDragActive, setPdfDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  function handleImageDrag(e: DragEvent, active: boolean) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(active);
  }

  function handlePdfDrag(e: DragEvent, active: boolean) {
    e.preventDefault();
    e.stopPropagation();
    setPdfDragActive(active);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function processFile(file: File) {
    setError(null);
    if (!ACCEPTED_IMAGES.includes(file.type)) {
      setError("Solo se aceptan archivos JPG, PNG o WEBP.");
      return;
    }
    if (file.size > IMAGE_MAX_MB * 1024 * 1024) {
      setError(`El archivo no puede superar los ${IMAGE_MAX_MB} MB.`);
      return;
    }
    setNewFile(file);
    const url = URL.createObjectURL(file);
    setNewPreview(url);
  }

  function handlePdfDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPdfDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processPdfFile(file);
  }

  function processPdfFile(file: File) {
    setError(null);
    if (file.type !== "application/pdf") {
      setError("Solo se aceptan archivos PDF.");
      return;
    }
    if (file.size > PDF_MAX_MB * 1024 * 1024) {
      setError(`El PDF no puede superar los ${PDF_MAX_MB} MB.`);
      return;
    }
    setNewPdfFile(file);
  }

  function removeNewFile() {
    if (newPreview) URL.revokeObjectURL(newPreview);
    setNewFile(null);
    setNewPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeNewPdfFile() {
    setNewPdfFile(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  }

  function removeExisting() {
    setExistingUrl(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let finalPreviewUrl: string | null = existingUrl;
    let finalFileUrl: string | null = currentFileUrl;

    // Si hay un archivo nuevo, subirlo
    if (newFile) {
      const path = `${userId}/${resumeId}/${newFile.name}`;
      const body = new FormData();
      body.append("file", newFile);
      body.append("bucket", "previews");
      body.append("path", path);

      const res = await fetch("/api/upload", { method: "POST", body });
      const result = await res.json();
      if (!res.ok) {
        setError("Error al subir la imagen: " + result.error);
        setLoading(false);
        return;
      }
      finalPreviewUrl = result.publicUrl;
    }

    if (newPdfFile) {
      const path = `${userId}/${resumeId}/${newPdfFile.name}`;
      const body = new FormData();
      body.append("file", newPdfFile);
      body.append("bucket", "resumes");
      body.append("path", path);

      const res = await fetch("/api/upload", { method: "POST", body });
      const result = await res.json();
      if (!res.ok) {
        setError("Error al subir el PDF: " + result.error);
        setLoading(false);
        return;
      }
      finalFileUrl = result.path;
    }

    const supabase = createClient();
    const payload = {
      preview_url: finalPreviewUrl,
      ...(newPdfFile ? { file_url: finalFileUrl } : {}),
    };
    const { error: dbError } = await supabase
      .from("resumes")
      .update(payload)
      .eq("id", resumeId);

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    toast.success(newPdfFile ? "Foto y PDF actualizados correctamente." : "Fotos actualizadas correctamente.");
    router.push("/sell/dashboard");
    router.refresh();
  }

  const hasAnything = !!existingUrl || !!newFile;
  const currentPdfName = currentFileUrl?.split("/").pop() ?? null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Info card */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-foreground">{resumeTitle}</h3>
        <p className="mt-0.5 text-xs text-gray-400">
          {resumeSubject} · {resumeUniversity}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Galería */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Foto de portada
          </h2>
          <p className="mb-4 text-xs text-gray-400">
            La foto de portada es la imagen que verán los compradores antes de adquirir tu apunte. Se muestra en los resultados de búsqueda y en la página del apunte.
          </p>

          {/* Foto existente */}
          {existingUrl && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-gray-500">Foto actual</p>
              <div className="relative inline-block">
                {/* Badge portada */}
                <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-accent-600 px-2 py-0.5 text-xs font-medium text-white shadow-sm">
                  <Star size={10} strokeWidth={2.5} className="fill-white" />
                  Portada
                </div>
                {/* Botón eliminar */}
                <button
                  type="button"
                  onClick={removeExisting}
                  aria-label="Eliminar foto actual"
                  className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={existingUrl}
                  alt="Foto de portada actual"
                  className="h-40 w-40 rounded-xl border border-gray-200 object-cover sm:h-48 sm:w-48"
                />
              </div>
            </div>
          )}

          {/* Nueva foto (preview) */}
          {newFile && newPreview && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-gray-500">
                {existingUrl ? "Nueva foto (reemplazará la actual)" : "Nueva foto"}
              </p>
              <div className="relative inline-block">
                {!existingUrl && (
                  <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-accent-600 px-2 py-0.5 text-xs font-medium text-white shadow-sm">
                    <Star size={10} strokeWidth={2.5} className="fill-white" />
                    Portada
                  </div>
                )}
                <button
                  type="button"
                  onClick={removeNewFile}
                  aria-label="Quitar nueva foto"
                  className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={newPreview}
                  alt="Nueva foto de portada"
                  className="h-40 w-40 rounded-xl border border-gray-200 object-cover sm:h-48 sm:w-48"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {newFile.name} · {(newFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}

          {/* Dropzone — solo mostrar si no hay nueva foto elegida */}
          {!newFile && (
            <div
              onDragEnter={(e) => handleImageDrag(e, true)}
              onDragOver={(e) => handleImageDrag(e, true)}
              onDragLeave={(e) => handleImageDrag(e, false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors duration-200 ${
                dragActive
                  ? "border-accent-500 bg-accent-50"
                  : "border-gray-300 bg-gray-50 hover:border-accent-400 hover:bg-accent-50"
              }`}
            >
              {dragActive ? (
                <Upload size={28} className="text-accent-500" strokeWidth={1.5} />
              ) : (
                <ImageIcon size={28} className="text-gray-400" strokeWidth={1.5} />
              )}
              <p className="mt-2 text-sm font-medium text-gray-600">
                {existingUrl ? "Subir nueva foto" : "Subir foto de portada"}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                Arrastrá una imagen o hacé click · JPG, PNG, WEBP · Máx. {IMAGE_MAX_MB} MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_IMAGES.join(",")}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processFile(file);
                }}
              />
            </div>
          )}

          {!hasAnything && !newFile && (
            <p className="mt-3 text-xs text-gray-400">
              Sin foto de portada, los compradores verán un placeholder genérico.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Archivo PDF
          </h2>
          <p className="mb-4 text-xs text-gray-400">
            Reemplazá el archivo del apunte si subiste una versión corregida o más completa.
          </p>

          {currentPdfName && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 text-xs font-medium text-gray-500">PDF actual</p>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-accent-600 ring-1 ring-gray-200">
                  <FileText size={20} strokeWidth={1.6} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-700">{currentPdfName}</p>
                  <p className="text-xs text-gray-400">Se mantiene si no elegís otro archivo.</p>
                </div>
              </div>
            </div>
          )}

          {newPdfFile ? (
            <div className="rounded-xl border border-accent-200 bg-accent-50 p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-accent-600 ring-1 ring-accent-100">
                  <FileText size={20} strokeWidth={1.6} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{newPdfFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(newPdfFile.size / 1024 / 1024).toFixed(2)} MB · Reemplazará el PDF actual
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeNewPdfFile}
                  aria-label="Quitar nuevo PDF"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragEnter={(e) => handlePdfDrag(e, true)}
              onDragOver={(e) => handlePdfDrag(e, true)}
              onDragLeave={(e) => handlePdfDrag(e, false)}
              onDrop={handlePdfDrop}
              onClick={() => pdfInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors duration-200 ${
                pdfDragActive
                  ? "border-accent-500 bg-accent-50"
                  : "border-gray-300 bg-gray-50 hover:border-accent-400 hover:bg-accent-50"
              }`}
            >
              {pdfDragActive ? (
                <Upload size={28} className="text-accent-500" strokeWidth={1.5} />
              ) : (
                <FileText size={28} className="text-gray-400" strokeWidth={1.5} />
              )}
              <p className="mt-2 text-sm font-medium text-gray-600">
                Cambiar archivo PDF
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                Arrastrá un PDF o hacé click · Máx. {PDF_MAX_MB} MB
              </p>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processPdfFile(file);
                }}
              />
            </div>
          )}
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
