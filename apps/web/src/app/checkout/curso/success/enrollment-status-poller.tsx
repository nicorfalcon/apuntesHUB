"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface EnrollmentStatusPollerProps {
  enrollmentId: string;
  courseId: string;
}

export function EnrollmentStatusPoller({
  enrollmentId,
  courseId,
}: EnrollmentStatusPollerProps) {
  const [status, setStatus] = useState<string>("pending");
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 20;

  useEffect(() => {
    if (status === "completed" || status === "failed" || attempts >= maxAttempts) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/courses/enrollments/${enrollmentId}/status`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
        }
      } catch {
        // ignorar errores de red
      }
      setAttempts((a) => a + 1);
    }, 3000);

    return () => clearTimeout(timer);
  }, [enrollmentId, status, attempts, maxAttempts]);

  if (status === "completed") {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">¡Estás inscripto!</h1>
        <p className="text-sm text-muted-foreground">
          Ya tenés acceso permanente a todos los módulos del curso.
        </p>
        <Link
          href={`/cursos/${courseId}`}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
        >
          Ir al curso
        </Link>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">El pago no se pudo procesar</h1>
        <p className="text-sm text-muted-foreground">Podés intentar nuevamente.</p>
        <Link
          href={`/cursos/${courseId}`}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
        >
          Volver al curso
        </Link>
      </div>
    );
  }

  if (attempts >= maxAttempts) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
          <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Procesando tu pago</h1>
        <p className="text-sm text-muted-foreground">
          Mercado Pago está confirmando tu pago. Si todo salió bien, en unos minutos vas a
          ver el curso desbloqueado.
        </p>
        <Link
          href={`/cursos/${courseId}`}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
        >
          Ir al curso
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-100">
        <svg className="h-8 w-8 text-accent-600 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Confirmando tu pago…</h1>
      <p className="text-sm text-muted-foreground">
        Estamos verificando la inscripción con Mercado Pago.
      </p>
    </div>
  );
}
