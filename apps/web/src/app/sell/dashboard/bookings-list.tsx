"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Video, Info, Check, Loader2, Link as LinkIcon, AlertCircle, Calendar, Download } from "lucide-react";
import { generateGoogleCalendarUrl } from "@/lib/calendar";
import { BlockedSlotsManager } from "@/components/tutors/blocked-slots-manager";

type BookingRow = {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number;
  hourly_rate_ars: number | null;
  amount: number | null;
  status: string;
  modality: string | null;
  meeting_url: string | null;
  location_details: string | null;
  initial_message: string | null;
  student_id: string | null;
  subjects: { name: string } | null;
  profiles: { display_name: string | null } | null;
};

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  requested: {
    label: "Pendiente",
    class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-100",
  },
  pending_payment: {
    label: "Esperando pago",
    class: "bg-orange-100 text-orange-800 dark:bg-orange-400/10 dark:text-orange-100",
  },
  confirmed: {
    label: "Confirmada",
    class: "bg-accent-100 text-accent-800 dark:bg-accent-300/15 dark:text-accent-100",
  },
  completed: {
    label: "Completada",
    class: "bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-100",
  },
  cancelled: {
    label: "Cancelada",
    class: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200",
  },
  expired: {
    label: "Expirada",
    class: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  },
  failed: {
    label: "Fallida",
    class: "bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-100",
  },
};

interface BookingsListProps {
  bookings: BookingRow[];
}

function BookingCard({ booking }: { booking: BookingRow }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState(booking.meeting_url || "");
  const [locationDetails, setLocationDetails] = useState(booking.location_details || "");
  const [isEditing, setIsEditing] = useState(false);

  const statusInfo = STATUS_LABELS[booking.status] ?? STATUS_LABELS.requested;
  const studentName = booking.profiles?.display_name ?? "Alumno";
  const subjectName = booking.subjects?.name ?? "Sin materia";
  
  // Handling array-like subject returns gracefully
  const actualSubject = Array.isArray(booking.subjects)
    ? booking.subjects[0]?.name ?? "Sin materia"
    : subjectName;

  const ingreso = booking.amount ?? (((booking.hourly_rate_ars ?? 0) * (booking.duration_minutes ?? 60)) / 60);
  
  const dateLabel = booking.scheduled_at
    ? new Date(booking.scheduled_at).toLocaleString("es-AR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Sin horario fijado";

  const isConfirmed = booking.status === "confirmed";
  const needsUrl = booking.modality === "online" || booking.modality === "ambas";
  const needsLocation = booking.modality === "presencial" || booking.modality === "ambas";

  const hasDetails = Boolean(booking.meeting_url || booking.location_details);

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!meetingUrl.trim() && !locationDetails.trim()) {
      toast.error("Completá al menos un dato");
      return;
    }

    if (needsUrl && meetingUrl.trim()) {
      try {
        new URL(meetingUrl.trim());
      } catch {
        toast.error("El link no es una URL válida (incluí https://)");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/tutors/bookings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: booking.id,
          action: "details",
          meeting_url: meetingUrl.trim() || null,
          location_details: locationDetails.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar los detalles");

      toast.success("Detalles guardados exitosamente. Se notificó al alumno.");
      setIsEditing(false);
      booking.meeting_url = meetingUrl.trim() || null;
      booking.location_details = locationDetails.trim() || null;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setIsSubmitting(false);
    }
  }

  let gcalUrl = "";
  if (isConfirmed && booking.scheduled_at) {
    let location = "";
    if (booking.modality === "online") {
      location = booking.meeting_url || "Online - datos pendientes";
    } else if (booking.modality === "presencial") {
      location = booking.location_details || "Ubicación pendiente";
    } else {
      if (booking.meeting_url && booking.location_details) {
        location = `${booking.location_details} (Link: ${booking.meeting_url})`;
      } else {
        location = booking.meeting_url || booking.location_details || "Datos de acceso pendientes";
      }
    }

    const descParts = [
      `Materia: ${actualSubject}`,
      `Profesor: Vos`,
      `Alumno: ${studentName}`,
      `Modalidad: ${booking.modality || "online"}`,
      `Estado: ${booking.status}`,
    ];

    if (booking.initial_message) {
      descParts.push(`\nNota del alumno: ${booking.initial_message}`);
    }

    gcalUrl = generateGoogleCalendarUrl({
      title: `Clase de ${actualSubject} con ${studentName}`,
      description: descParts.join("\n"),
      location,
      startDate: new Date(booking.scheduled_at),
      durationMinutes: booking.duration_minutes ?? 60,
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusInfo.class}`}>
              {statusInfo.label}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground dark:bg-white/5">
              {booking.modality ?? "online"}
            </span>
            {isConfirmed && !hasDetails && (
              <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-400/10 dark:text-red-100">
                <AlertCircle className="h-3 w-3" />
                Falta completar acceso
              </span>
            )}
          </div>
          <h3 className="truncate text-base font-bold text-foreground">
            {studentName}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {actualSubject} · <span className="font-medium text-foreground">{dateLabel}</span> · {booking.duration_minutes} min
          </p>
        </div>

        <div className="flex shrink-0 flex-row items-end justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
          <span className="text-xs text-muted-foreground sm:order-2">Precio total</span>
          <span className="text-lg font-bold text-accent-700 dark:text-accent-300">
            ${Math.round(ingreso).toLocaleString("es-AR")}
          </span>
        </div>
      </div>

      {booking.initial_message && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 dark:border-white/5 dark:bg-white/[0.02] dark:text-gray-300">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">
            <Info className="h-3.5 w-3.5" />
            Nota del alumno
          </div>
          <p className="whitespace-pre-wrap">{booking.initial_message}</p>
        </div>
      )}

      {isConfirmed && (
        <div className="mt-2 border-t border-gray-100 pt-4 dark:border-white/5">
          {!isEditing && hasDetails ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground">Datos de acceso enviados</h4>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-md px-2 py-1 text-xs font-bold text-accent-700 underline-offset-4 hover:bg-accent-50 hover:underline dark:text-accent-100 dark:hover:bg-accent-300/10"
                >
                  Modificar
                </button>
              </div>
              
              {booking.meeting_url && (
                <div className="flex items-center gap-2 text-sm">
                  <Video className="h-4 w-4 text-accent-700 dark:text-accent-100" />
                  <a href={booking.meeting_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400 break-all">
                    {booking.meeting_url}
                  </a>
                </div>
              )}
              
              {booking.location_details && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-700 dark:text-accent-100" />
                  <span className="text-foreground whitespace-pre-wrap">{booking.location_details}</span>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveDetails} className="flex flex-col gap-3">
              <h4 className="text-sm font-bold text-foreground">
                {hasDetails ? "Modificar acceso" : "Completá los datos de acceso para el alumno"}
              </h4>
              {!hasDetails && (
                <p className="text-xs leading-5 text-muted-foreground">
                  El alumno verá estos datos cuando la clase esté confirmada.
                </p>
              )}
              
              {needsUrl && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`meeting-url-${booking.id}`} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                    <Video className="h-3.5 w-3.5" />
                    Link de clase online
                  </label>
                  <input
                    id={`meeting-url-${booking.id}`}
                    type="url"
                    placeholder="https://meet.google.com/..."
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-foreground placeholder-gray-400 transition-colors focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-white/10 dark:bg-[#071713] dark:placeholder-gray-500 dark:focus:border-accent-300 dark:focus:ring-accent-300"
                  />
                </div>
              )}

              {needsLocation && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`location-details-${booking.id}`} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Ubicación presencial / Instrucciones
                  </label>
                  <textarea
                    id={`location-details-${booking.id}`}
                    placeholder="Ej: Biblioteca Nacional, mesa del fondo. Traer cuaderno."
                    value={locationDetails}
                    onChange={(e) => setLocationDetails(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-foreground placeholder-gray-400 transition-colors focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-white/10 dark:bg-[#071713] dark:placeholder-gray-500 dark:focus:border-accent-300 dark:focus:ring-accent-300"
                  />
                </div>
              )}

              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={isSubmitting || (!meetingUrl.trim() && !locationDetails.trim())}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-accent-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-700 disabled:opacity-50 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {hasDetails ? "Guardar cambios" : "Enviar al alumno"}
                </button>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setMeetingUrl(booking.meeting_url || "");
                      setLocationDetails(booking.location_details || "");
                    }}
                    className="rounded-lg px-4 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-gray-100 dark:hover:bg-white/5"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Calendar CTAs */}
          {!isEditing && booking.scheduled_at && (
            <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-white/5 sm:flex-row">
              <a
                href={gcalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 sm:w-1/2"
              >
                <Calendar className="h-3.5 w-3.5" />
                Google Calendar
              </a>
              <a
                href={`/api/tutors/bookings/${booking.id}/calendar.ics`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5 sm:w-1/2"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar .ics
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BookingsList({ bookings }: BookingsListProps) {
  const now = new Date();
  
  const upcoming = bookings.filter(b => {
    if (!b.scheduled_at) return true;
    return new Date(b.scheduled_at) >= now;
  });

  const past = bookings.filter(b => {
    if (!b.scheduled_at) return false;
    return new Date(b.scheduled_at) < now;
  });

  return (
    <div className="flex flex-col gap-8">
      <BlockedSlotsManager />
      
      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-14 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200 dark:bg-[#071713] dark:ring-white/10">
            <LinkIcon className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-foreground">
            No hay clases reservadas
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando un alumno reserve una clase, aparecerá acá.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section>
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Próximas clases ({upcoming.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {upcoming.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Clases pasadas ({past.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {past.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
