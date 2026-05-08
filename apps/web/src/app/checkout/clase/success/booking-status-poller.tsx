"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatTimeInArgentina } from "@/lib/timezone";
import { Calendar, Download } from "lucide-react";
import { generateGoogleCalendarUrl } from "@/lib/calendar";

interface BookingStatusPollerProps {
  bookingId: string;
  initialStatus: string;
  tutorName: string;
  subjectName: string;
  scheduledAt: string | null;
  durationMinutes: number;
  modality: string;
  amount: number | null;
  meetingUrl?: string | null;
  locationDetails?: string | null;
  initialMessage?: string | null;
}

export function BookingStatusPoller({
  bookingId,
  initialStatus,
  tutorName,
  subjectName,
  scheduledAt,
  durationMinutes,
  modality,
  amount,
  meetingUrl,
  locationDetails,
  initialMessage,
}: BookingStatusPollerProps) {
  const [status, setStatus] = useState<string>(initialStatus);
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 20;

  useEffect(() => {
    if (
      status === "confirmed" ||
      status === "failed" ||
      status === "expired" ||
      status === "cancelled" ||
      status === "completed" ||
      attempts >= maxAttempts
    ) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tutors/bookings/${bookingId}/status`);
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
  }, [bookingId, status, attempts, maxAttempts]);

  // Formateo de fecha y hora
  let dateLabel = "Fecha a coordinar";
  let timeLabel = "";
  
  if (scheduledAt) {
    const d = new Date(scheduledAt);
    dateLabel = d.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Argentina/Buenos_Aires",
    });
    // Capitalize first letter
    dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
    timeLabel = formatTimeInArgentina(d);
  }

  const isConfirmed = status === "confirmed" || status === "completed";
  const isFailed = status === "failed" || status === "expired" || status === "cancelled";
  const isPending = !isConfirmed && !isFailed; // pending_payment

  // Calendar logic
  let gcalUrl = "";
  if (isConfirmed && scheduledAt) {
    let location = "";
    if (modality === "online") {
      location = meetingUrl || "Online - datos pendientes";
    } else if (modality === "presencial") {
      location = locationDetails || "Ubicación pendiente";
    } else {
      if (meetingUrl && locationDetails) {
        location = `${locationDetails} (Link: ${meetingUrl})`;
      } else {
        location = meetingUrl || locationDetails || "Datos de acceso pendientes";
      }
    }

    const descParts = [
      `Materia: ${subjectName}`,
      `Profesor: ${tutorName}`,
      `Alumno: Vos`,
      `Modalidad: ${modality || "online"}`,
      `Estado: ${status}`,
    ];

    if (initialMessage) {
      descParts.push(`\nTu nota: ${initialMessage}`);
    }

    gcalUrl = generateGoogleCalendarUrl({
      title: `Clase de ${subjectName} con ${tutorName}`,
      description: descParts.join("\n"),
      location,
      startDate: new Date(scheduledAt),
      durationMinutes: durationMinutes ?? 60,
    });
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f1e1a] sm:p-8 space-y-6">
      
      {/* Icono de Estado */}
      <div className="flex flex-col items-center text-center space-y-3">
        {isConfirmed && (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/20">
            <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        
        {isFailed && (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
            <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}

        {isPending && attempts < maxAttempts && (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-100 dark:bg-accent-500/20">
            <svg className="h-8 w-8 animate-spin text-accent-600 dark:text-accent-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {isPending && attempts >= maxAttempts && (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-500/20">
            <svg className="h-8 w-8 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}

        {/* Títulos y Mensajes */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isConfirmed ? "Clase reservada" : isFailed ? "Reserva no procesada" : "Confirmando tu pago..."}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isConfirmed 
              ? "Tu clase fue reservada correctamente." 
              : isFailed 
              ? "Hubo un problema con el pago o la reserva expiró." 
              : attempts >= maxAttempts 
              ? "Mercado Pago sigue procesando tu pago. Te notificaremos cuando se confirme." 
              : "Estamos confirmando el pago. Esto puede tardar unos segundos."}
          </p>
        </div>
      </div>

      {/* Tarjeta de Resumen */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-white/5 dark:bg-white/[0.02]">
        <h2 className="text-sm font-semibold text-foreground mb-4">Detalles de la clase</h2>
        
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Profesor</dt>
            <dd className="font-medium text-foreground">{tutorName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Materia</dt>
            <dd className="font-medium text-foreground">{subjectName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Fecha</dt>
            <dd className="font-medium text-foreground">{dateLabel}</dd>
          </div>
          {timeLabel && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Horario</dt>
              <dd className="font-medium text-foreground">{timeLabel} hs</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Duración</dt>
            <dd className="font-medium text-foreground">{durationMinutes} minutos</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Modalidad</dt>
            <dd className="font-medium capitalize text-foreground">{modality}</dd>
          </div>
          <div className="pt-3 border-t border-gray-200 dark:border-white/10 flex justify-between">
            <dt className="font-semibold text-foreground">Precio</dt>
            <dd className="font-semibold text-foreground">
              ${amount?.toLocaleString("es-AR")}
            </dd>
          </div>
        </dl>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 pt-2">
        {isConfirmed && scheduledAt && (
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <a
              href={gcalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-1/2 items-center justify-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-500"
            >
              <Calendar className="w-4 h-4" />
              Agregar a Google
            </a>
            <a
              href={`/api/tutors/bookings/${bookingId}/calendar.ics`}
              className="inline-flex w-full sm:w-1/2 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <Download className="w-4 h-4" />
              Descargar .ics
            </a>
          </div>
        )}
        <Link
          href="/explorar?tab=particulares"
          className="inline-flex w-full items-center justify-center rounded-lg border border-gray-200 bg-transparent px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
        >
          Volver a explorar profesores
        </Link>
      </div>
    </div>
  );
}
