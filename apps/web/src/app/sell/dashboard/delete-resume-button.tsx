"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteResumeButton({ resumeId }: { resumeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("¿Estás seguro que querés eliminar este apunte? Esta acción no se puede deshacer.")) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("resumes").delete().eq("id", resumeId);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
    >
      {loading ? "..." : "Eliminar"}
    </button>
  );
}
