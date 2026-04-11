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
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-shadow focus:border-[#1B5E45] focus:shadow-[0_0_0_2px_rgba(27,94,69,0.10)] placeholder:text-gray-400";
  const labelClass = "mb-1 block text-sm font-medium text-gray-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Profile block */}
      <div className="flex items-center gap-4 rounded-xl border border-[#c8e6d8] bg-[#f0faf5] px-5 py-4">
        {/* Avatar with pencil button */}
        <div className="relative shrink-0">
          <div className="h-16 w-16 overflow-hidden rounded-full">
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt="Avatar"
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-xl font-semibold text-white"
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
            className="absolute -bottom-0.5 -right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white bg-[#1B5E45] text-white shadow-sm transition-colors hover:bg-[#155038]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-[10px] w-[10px]"
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
          <p className="text-base font-medium text-gray-900">
            {form.display_name || "Sin nombre"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className="rounded-[10px] px-2 py-0.5 text-[11px] font-medium leading-4"
              style={{ backgroundColor: "#E1F5EE", color: "#085041" }}
            >
              Verificado
            </span>
            {memberSince && (
              <span className="text-xs text-gray-400">Miembro desde {memberSince}</span>
            )}
          </div>
        </div>
      </div>

      {/* Section label */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.5px] text-gray-400">
          Información personal
        </p>
        <hr className="border-gray-100" />
      </div>

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
            className={inputClass}
            placeholder="Contá algo sobre vos..."
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* Footer */}
      <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
          style={{ backgroundColor: "#1B5E45", color: "#E1F5EE" }}
        >
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
