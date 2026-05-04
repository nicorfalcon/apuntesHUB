"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_MAX_LABEL = "5 MB";

interface CourseCoverUploadProps {
  courseId: string;
  userId: string;
  title: string;
  coverColor: string | null;
  coverImageUrl: string | null;
}

export function CourseCoverUpload({
  courseId,
  userId,
  title,
  coverColor,
  coverImageUrl,
}: CourseCoverUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [currentUrl, setCurrentUrl] = useState(coverImageUrl);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCurrentUrl(coverImageUrl);
  }, [coverImageUrl]);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  async function uploadCover(file: File) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${userId}/courses/${courseId}-${crypto.randomUUID()}-${safeName}`;
    const supabase = createClient();

    const response = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket: "previews", path }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { token?: string; path?: string; publicUrl?: string | null; error?: string }
      | null;

    if (!response.ok || !payload?.token || !payload.path || !payload.publicUrl) {
      throw new Error(payload?.error ?? "No pudimos preparar la imagen.");
    }

    const { error: uploadError } = await supabase.storage
      .from("previews")
      .uploadToSignedUrl(payload.path, payload.token, file, { upsert: true });

    if (uploadError) throw new Error(uploadError.message);

    return payload.publicUrl;
  }

  async function persistCover(cover_image_url: string | null) {
    const response = await fetch(`/api/courses/${courseId}/cover`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cover_image_url }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? "No pudimos actualizar la portada.");
    }
  }

  async function processFile(file: File) {
    if (!ACCEPTED_IMAGES.includes(file.type)) {
      toast.error("Subí una imagen JPG, PNG o WEBP.");
      return;
    }

    if (file.size > IMAGE_MAX_BYTES) {
      toast.error(`La imagen no puede superar ${IMAGE_MAX_LABEL}.`);
      return;
    }

    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));
    setLoading(true);

    try {
      const publicUrl = await uploadCover(file);
      await persistCover(publicUrl);
      setCurrentUrl(publicUrl);
      toast.success("Portada del curso actualizada.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No pudimos actualizar la portada."
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeCover() {
    setLoading(true);
    try {
      await persistCover(null);
      setCurrentUrl(null);
      if (localPreview) URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
      toast.success("Portada del curso quitada.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No pudimos quitar la portada."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (file) void processFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0] ?? null;
    if (file) void processFile(file);
  }

  const previewUrl = localPreview ?? currentUrl;

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragActive(false);
      }}
      onDrop={handleDrop}
      className={`group relative min-h-[116px] overflow-hidden rounded-xl border bg-accent-900 text-white lg:min-h-[104px] ${
        dragActive
          ? "border-accent-300 ring-2 ring-accent-200/70 dark:ring-accent-300/20"
          : "border-white/10"
      }`}
      style={{
        backgroundColor: coverColor ?? "#263833",
        backgroundImage: previewUrl
          ? `linear-gradient(0deg, rgba(0,0,0,.54), rgba(0,0,0,.08)), url(${previewUrl})`
          : undefined,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      {!previewUrl && (
        <>
          <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,.24),transparent_28%),linear-gradient(135deg,rgba(255,255,255,.14)_0_1px,transparent_1px)] [background-size:auto,20px_20px]" />
          <ImageIcon className="absolute left-4 top-4 h-4 w-4 text-white/70" />
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="line-clamp-2 max-w-[11rem] text-xs font-bold leading-4 text-white">
          {title}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-white/65">
          {previewUrl ? "Portada cargada" : "Sin portada"}
        </p>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        </div>
      )}

      <div
        className={`absolute right-2.5 top-2.5 flex gap-1.5 transition-opacity ${
          previewUrl ? "opacity-100 lg:opacity-0 lg:group-hover:opacity-100" : "opacity-100"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGES.join(",")}
          className="sr-only"
          aria-label={`Subir portada de ${title}`}
          onChange={handleChange}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-white/20 bg-black/40 px-2 text-[11px] font-semibold text-white backdrop-blur transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Cambiar portada de ${title}`}
        >
          <UploadCloud className="h-3.5 w-3.5" />
          {currentUrl ? "Cambiar" : "Subir"}
        </button>
        {currentUrl && (
          <button
            type="button"
            onClick={removeCover}
            disabled={loading}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-white/20 bg-black/40 px-2 text-[11px] font-semibold text-white backdrop-blur transition-colors hover:bg-red-600/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" />
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}
