"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface PurchaseButtonProps {
  resumeId: string;
  isLoggedIn: boolean;
}

export function PurchaseButton({ resumeId, isLoggedIn }: PurchaseButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/resume/${resumeId}`);
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("purchase_resume", {
      p_resume_id: resumeId,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/my-purchases");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handlePurchase}
        disabled={loading}
        className="mt-4 w-full rounded-lg bg-accent-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-60"
      >
        {loading ? "Procesando..." : isLoggedIn ? "Comprar apunte" : "Iniciar sesión para comprar"}
      </button>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
