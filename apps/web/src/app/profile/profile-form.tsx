"use client";

import { useState } from "react";
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
  const [form, setForm] = useState({
    display_name: profile?.display_name ?? "",
    bio: profile?.bio ?? "",
    university: profile?.university ?? "",
    career: profile?.career ?? "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    let avatarUrl = profile?.avatar_url ?? null;

    if (avatarFile) {
      const path = `${userId}/${avatarFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true });
      if (uploadError) {
        setError("Error al subir el avatar: " + uploadError.message);
        setLoading(false);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      avatarUrl = data.publicUrl;
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
      router.refresh();
    }
    setLoading(false);
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Avatar actual */}
      {profile?.avatar_url && (
        <Image
          src={profile.avatar_url}
          alt="Avatar"
          width={64}
          height={64}
          className="rounded-full object-cover"
        />
      )}

      <div>
        <label htmlFor="display_name" className="block text-sm font-medium text-gray-700">
          Nombre público *
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
        <label htmlFor="bio" className="block text-sm font-medium text-gray-700">Biografía</label>
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="university" className="block text-sm font-medium text-gray-700">Universidad</label>
          <input id="university" name="university" value={form.university} onChange={handleChange} className={inputClass} placeholder="UBA" />
        </div>
        <div>
          <label htmlFor="career" className="block text-sm font-medium text-gray-700">Carrera</label>
          <input id="career" name="career" value={form.career} onChange={handleChange} className={inputClass} placeholder="Abogacía" />
        </div>
      </div>

      <div>
        <label htmlFor="avatar" className="block text-sm font-medium text-gray-700">
          Foto de perfil
        </label>
        <input
          id="avatar"
          type="file"
          accept="image/*"
          onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-accent-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-700"
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-60"
      >
        {loading ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
