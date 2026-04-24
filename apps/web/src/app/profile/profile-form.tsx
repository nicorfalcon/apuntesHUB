"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/database.types";

interface ProfileFormProps {
  userId: string;
  profile: Profile | null;
}

export function ProfileForm({ userId, profile }: ProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    display_name: profile?.display_name ?? "",
    bio: profile?.bio ?? "",
    university: profile?.university ?? "",
    career: profile?.career ?? "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setAvatarFile(file);
    if (file) {
      setAvatarPreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    let avatarUrl = profile?.avatar_url ?? null;

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true });
      if (uploadError) {
        setError("Error al subir el avatar: " + uploadError.message);
        setLoading(false);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      // Append timestamp to bust cache
      avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name,
        bio: form.bio || null,
        university: form.university || null,
        career: form.career || null,
        avatar_url: avatarUrl,
      })
      .eq("id", userId);

    if (error) {
      setError(error.message);
      toast.error("No se pudo guardar el perfil.");
    } else {
      toast.success("Perfil actualizado correctamente.");
      window.dispatchEvent(new Event("profile-updated"));
      router.refresh();
    }
    setLoading(false);
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric",
    })
    : null;

  const initial = (form.display_name || "U")[0].toUpperCase();
  const avatarSrc = avatarPreview ?? profile?.avatar_url ?? null;

  const inputClass =
    "w-full rounded-xl border border-gray-200/80 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-accent-400 focus:ring-2 focus:ring-accent-200/40 placeholder:text-gray-400";
  const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Profile block */}
      <div className="flex items-center gap-5 rounded-2xl border border-accent-200/60 bg-gradient-to-br from-accent-50 to-white px-6 py-5">
        {/* Avatar with pencil button */}
        <div className="relative shrink-0">
          <div className="h-[88px] w-[88px] overflow-hidden rounded-full ring-[3px] ring-accent-200/60 ring-offset-2 ring-offset-white">
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt="Avatar"
                width={88}
                height={88}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white"
                style={{ backgroundColor: "#1B5E45" }}
              >
                {initial}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Cambiar foto de perfil"
            className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-white bg-[#1B5E45] text-white shadow-md transition-all hover:bg-[#155038] hover:scale-110"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-3 w-3"
            >
              <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L2.317 11.209a1.75 1.75 0 0 0-.468.848l-.758 3.03a.75.75 0 0 0 .921.921l3.03-.758a1.75 1.75 0 0 0 .848-.468l8.696-8.696a1.75 1.75 0 0 0 0-2.475ZM4.498 12.502l-2.032.508.508-2.032 8.19-8.19 1.524 1.524-8.19 8.19Z" />
            </svg>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

        {/* Name + badge + member since */}
        <div>
          <p className="text-lg font-semibold text-gray-900">
            {form.display_name || "Sin nombre"}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-semibold text-accent-700 ring-1 ring-inset ring-accent-200/60">
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              Verificado
            </span>
            {memberSince && (
              <span className="text-xs text-gray-400">Miembro desde {memberSince}</span>
            )}
          </div>
        </div>
      </div>

      {/* Section label */}
      <fieldset>
        <legend className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-700">
          <svg className="h-3.5 w-3.5 text-accent-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
          </svg>
          Información personal
        </legend>

        {/* Form grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="display_name" className={labelClass}>
              Nombre público <span className="text-red-500">*</span>
            </label>
            <input
              id="display_name"
              name="display_name"
              required
              value={form.display_name}
              onChange={handleChange}
              className={inputClass}
              placeholder="Juan Pérez"
            />
          </div>

          <div>
            <label htmlFor="university" className={labelClass}>
              Universidad
            </label>
            <input
              id="university"
              name="university"
              value={form.university}
              onChange={handleChange}
              className={inputClass}
              placeholder="UBA"
            />
          </div>

          <div>
            <label htmlFor="career" className={labelClass}>
              Carrera
            </label>
            <input
              id="career"
              name="career"
              value={form.career}
              onChange={handleChange}
              className={inputClass}
              placeholder="Abogacía"
            />
          </div>

          <div className="col-span-2">
            <label htmlFor="bio" className={labelClass}>
              Biografía
            </label>
            <textarea
              id="bio"
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={3}
              maxLength={300}
              className={`${inputClass} resize-none`}
              placeholder="Contá algo sobre vos..."
            />
          </div>
        </div>
      </fieldset>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* Footer */}
      <div className="flex justify-end gap-3 border-t border-gray-100 pt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 hover:bg-gray-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl px-6 py-2.5 text-sm font-semibold shadow-sm transition-all disabled:opacity-60 hover:shadow-md"
          style={{ backgroundColor: "#1B5E45", color: "#E1F5EE" }}
        >
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
