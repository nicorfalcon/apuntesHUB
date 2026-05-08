"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatTimeInArgentina } from "@/lib/timezone";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock3,
  Download,
  MapPin,
  Video,
  XCircle,
} from "lucide-react";
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
  const accessLabel =
    modality === "online"
      ? "Link de la clase"
      : modality === "presencial"
        ? "Ubicación"
        : "Datos de acceso";
  const accessValue =
    modality === "online"
      ? meetingUrl
      : modality === "presencial"
        ? locationDetails
        : meetingUrl || locationDetails;
  const accessPendingText =
    modality === "online"
      ? "El profesor todavía no cargó el link de la clase. Te avisaremos cuando esté disponible."
      : modality === "presencial"
        ? "El profesor todavía no cargó la ubicación. Te avisaremos cuando esté disponible."
        : "El profesor todavía no cargó los datos de acceso. Te avisaremos cuando estén disponibles.";

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
    <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f1e1a] sm:p-8">
      
      {/* Icono de Estado */}
      <div className="flex flex-col items-center space-y-3 text-center">
        {isConfirmed && (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/20">
            <CheckCircle2 className="h-8 w-8 text-green-700 dark:text-green-300" />
          </div>
        )}
        
        {isFailed && (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
            <XCircle className="h-8 w-8 text-red-700 dark:text-red-300" />
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
            <Clock3 className="h-8 w-8 text-yellow-700 dark:text-yellow-300" />
          </div>
        )}

        {/* Títulos y Mensajes */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isConfirmed ? "Clase reservada" : isFailed ? "Reserva no procesada" : "Confirmando tu pago..."}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
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
        <h2 className="mb-4 text-sm font-semibold text-foreground">Detalles de la clase</h2>
        
        <dl className="space-y-3 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-muted-foreground">Profesor</dt>
            <dd className="font-medium text-foreground">{tutorName}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-muted-foreground">Materia</dt>
            <dd className="font-medium text-foreground">{subjectName}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-muted-foreground">Fecha</dt>
            <dd className="font-medium text-foreground">{dateLabel}</dd>
          </div>
          {timeLabel && (
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <dt className="text-muted-foreground">Horario</dt>
              <dd className="font-medium text-foreground">{timeLabel} hs</dd>
            </div>
          )}
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-muted-foreground">Duración</dt>
            <dd className="font-medium text-foreground">{durationMinutes} minutos</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-muted-foreground">Modalidad</dt>
            <dd className="font-medium capitalize text-foreground">{modality}</dd>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-3 dark:border-white/10">
            <dt className="font-semibold text-foreground">Precio</dt>
            <dd className="font-semibold text-foreground">
              {amount !== null ? `$${amount.toLocaleString("es-AR")}` : "A confirmar"}
            </dd>
          </div>
        </dl>
      </div>

      {isConfirmed && (
        <div className="rounded-xl border border-accent-200 bg-accent-50/70 p-4 dark:border-accent-300/20 dark:bg-accent-300/10">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-accent-700 ring-1 ring-accent-200 dark:bg-[#071713] dark:text-accent-100 dark:ring-accent-300/20">
              {modality === "presencial" ? (
                <MapPin className="h-4 w-4" />
              ) : (
                <Video className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{accessLabel}</p>
              {accessValue ? (
                modality === "online" || meetingUrl === accessValue ? (
                  <a
                    href={accessValue}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block break-all text-sm font-medium text-accent-700 underline-offset-4 hover:underline dark:text-accent-100"
                  >
                    {accessValue}
                  </a>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {accessValue}
                  </p>
                )
              ) : (
                <p className="mt-1 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-700 dark:text-accent-100" />
                  {accessPendingText}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="flex flex-col gap-3 pt-2">
        {isConfirmed && scheduledAt && (
          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <a
              href={gcalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200 sm:w-1/2"
            >
              <Calendar className="h-4 w-4" />
              Agregar a Google
            </a>
            <a
              href={`/api/tutors/bookings/${bookingId}/calendar.ics`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 sm:w-1/2"
            >
              <Download className="h-4 w-4" />
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
