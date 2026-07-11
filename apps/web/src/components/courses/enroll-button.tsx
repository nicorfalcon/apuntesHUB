"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingCart } from "lucide-react";

interface EnrollButtonProps {
  courseId: string;
  /** Si no hay sesión, mandamos a login con redirect al curso. */
  isAuthenticated: boolean;
}

export function EnrollButton({ courseId, isAuthenticated }: EnrollButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/cursos/${courseId}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/courses/${courseId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "No pudimos iniciar la inscripción.");
        setLoading(false);
        return;
      }

      const target = (data.redirectUrl ?? data.initPoint) as string | undefined;
      if (target) {
        window.location.href = target;
        return;
      }

      setError("No se obtuvo un link de pago.");
      setLoading(false);
    } catch {
      setError("Error de red. Probá de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-65 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirigiendo a Mercado Pago…
          </>
        ) : (
          <>
            Inscribirme
            <ShoppingCart className="h-4 w-4" />
          </>
        )}
      </button>
      {error && (
        <p className="text-xs leading-5 text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
