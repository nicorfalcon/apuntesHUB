"use client";

import { useState, useRef, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Upload, ImageIcon, X, Star } from "lucide-react";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 5;

interface PhotosFormProps {
  resumeId: string;
  userId: string;
  resumeTitle: string;
  resumeSubject: string;
  resumeUniversity: string;
  currentPreviewUrl: string | null;
}

export function PhotosForm({
  resumeId,
  userId,
  resumeTitle,
  resumeSubject,
  resumeUniversity,
  currentPreviewUrl,
}: PhotosFormProps) {
  const router = useRouter();

  // Estado de la foto existente: si el usuario la "elimina" la marcamos como null
  const [existingUrl, setExistingUrl] = useState<string | null>(currentPreviewUrl);
  // Nueva foto a subir
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newPreview, setNewPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDrag(e: DragEvent, active: boolean) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(active);
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
    if (!ACCEPTED.includes(file.type)) {
      setError("Solo se aceptan archivos JPG, PNG o WEBP.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo no puede superar los ${MAX_MB} MB.`);
      return;
    }
    setNewFile(file);
    const url = URL.createObjectURL(file);
    setNewPreview(url);
  }

  function removeNewFile() {
    if (newPreview) URL.revokeObjectURL(newPreview);
    setNewFile(null);
    setNewPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeExisting() {
    setExistingUrl(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let finalPreviewUrl: string | null = existingUrl;

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

    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("resumes")
      .update({ preview_url: finalPreviewUrl })
      .eq("id", resumeId);

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    toast.success("Fotos actualizadas correctamente.");
    router.push("/sell/dashboard");
    router.refresh();
  }

  const hasAnything = !!existingUrl || !!newFile;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Info card */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-foreground">{resumeTitle}</h3>
        <p className="mt-0.5 text-xs text-gray-400">
          {resumeSubject} · {resumeUniversity}
        </p>
      </div>

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
            onDragEnter={(e) => handleDrag(e, true)}
            onDragOver={(e) => handleDrag(e, true)}
            onDragLeave={(e) => handleDrag(e, false)}
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
              Arrastrá una imagen o hacé click · JPG, PNG, WEBP · Máx. {MAX_MB} MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED.join(",")}
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
