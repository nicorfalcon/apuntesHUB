"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Download,
  MapPin,
  Search,
  Video,
} from "lucide-react";
import { generateGoogleCalendarUrl } from "@/lib/calendar";
import { formatTimeInArgentina } from "@/lib/timezone";

type StudentBooking = {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  amount: number | null;
  status: string;
  modality: string | null;
  meeting_url: string | null;
  location_details: string | null;
  initial_message: string | null;
  subjects: { name: string } | { name: string }[] | null;
  tutor: { display_name: string | null } | { display_name: string | null }[] | null;
};

interface StudentBookingsListProps {
  bookings: StudentBooking[];
}

type StudentBookingTab = "upcoming" | "past" | "cancelled";
const PAGE_SIZE = 8;

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  requested: {
    label: "Pendiente",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-100",
  },
  pending_payment: {
    label: "Esperando pago",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-400/10 dark:text-orange-100",
  },
  confirmed: {
    label: "Confirmada",
    className: "bg-accent-100 text-accent-800 dark:bg-accent-300/15 dark:text-accent-100",
  },
  completed: {
    label: "Completada",
    className: "bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-100",
  },
  cancelled: {
    label: "Cancelada",
    className: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200",
  },
  expired: {
    label: "Expirada",
    className: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  },
  failed: {
    label: "Fallida",
    className: "bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-100",
  },
};

function relationName(
  value: { name?: string | null; display_name?: string | null } | { name?: string | null; display_name?: string | null }[] | null,
  fallback: string
) {
  const item = Array.isArray(value) ? value[0] : value;
  return item?.name ?? item?.display_name ?? fallback;
}

function formatDateLabel(value: string | null) {
  if (!value) return "Fecha a coordinar";
  const date = new Date(value);
  const label = date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatModality(value: string | null) {
  if (value === "presencial") return "Presencial";
  if (value === "ambas") return "Online y presencial";
  return "Online";
}

function accessCopy(booking: StudentBooking) {
  const modality = booking.modality ?? "online";

  if (modality === "presencial") {
    return {
      label: "Ubicación",
      value: booking.location_details,
      pending: "El profesor todavía no cargó la ubicación.",
      icon: MapPin,
    };
  }

  if (modality === "ambas") {
    return {
      label: "Datos de acceso",
      value: booking.meeting_url || booking.location_details,
      pending: "El profesor todavía no cargó el link o la ubicación.",
      icon: Video,
    };
  }

  return {
    label: "Link de la clase",
    value: booking.meeting_url,
    pending: "El profesor todavía no cargó el link de la clase.",
    icon: Video,
  };
}

function StudentBookingCard({ booking }: { booking: StudentBooking }) {
  const subjectName = relationName(booking.subjects, "Materia");
  const tutorName = relationName(booking.tutor, "Profesor");
  const statusInfo = STATUS_LABELS[booking.status] ?? STATUS_LABELS.requested;
  const scheduledAt = booking.scheduled_at ? new Date(booking.scheduled_at) : null;
  const access = accessCopy(booking);
  const AccessIcon = access.icon;
  const isConfirmed = booking.status === "confirmed" || booking.status === "completed";

  let gcalUrl = "";
  if (isConfirmed && scheduledAt) {
    const location =
      booking.meeting_url ||
      booking.location_details ||
      "Datos de acceso pendientes";
    gcalUrl = generateGoogleCalendarUrl({
      title: `Clase de ${subjectName} con ${tutorName}`,
      description: [
        `Materia: ${subjectName}`,
        `Profesor: ${tutorName}`,
        `Modalidad: ${formatModality(booking.modality)}`,
        `Estado: ${booking.status}`,
        booking.initial_message ? `\nTu nota: ${booking.initial_message}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      location,
      startDate: scheduledAt,
      durationMinutes: booking.duration_minutes ?? 60,
    });
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-muted-foreground dark:bg-white/5">
              {formatModality(booking.modality)}
            </span>
          </div>
          <h3 className="mt-3 text-base font-bold text-foreground">
            {subjectName}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Con <span className="font-medium text-foreground">{tutorName}</span>
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-sm font-bold text-foreground">
            {formatDateLabel(booking.scheduled_at)}
          </p>
          {scheduledAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              {formatTimeInArgentina(scheduledAt)} hs · {booking.duration_minutes ?? 60} min
            </p>
          )}
          {booking.amount !== null && (
            <p className="mt-2 text-sm font-bold text-accent-700 dark:text-accent-300">
              ${Number(booking.amount).toLocaleString("es-AR")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-white/5 dark:bg-white/[0.02]">
        <div className="flex items-start gap-2">
          <AccessIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-700 dark:text-accent-100" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {access.label}
            </p>
            {access.value ? (
              booking.meeting_url === access.value ? (
                <a
                  href={access.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block break-all text-sm font-semibold text-accent-700 underline-offset-4 hover:underline dark:text-accent-100"
                >
                  {access.value}
                </a>
              ) : (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {access.value}
                </p>
              )
            ) : (
              <p className="mt-1 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {access.pending} Te avisaremos cuando esté disponible.
              </p>
            )}
          </div>
        </div>
      </div>

      {isConfirmed && scheduledAt && (
        <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-white/5 sm:flex-row">
          <a
            href={gcalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200 sm:w-1/2"
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
    </article>
  );
}

export function StudentBookingsList({ bookings }: StudentBookingsListProps) {
  const [activeTab, setActiveTab] = useState<StudentBookingTab>("upcoming");
  const [page, setPage] = useState(1);
  const grouped = useMemo(() => {
    const now = new Date();
    const cancelledStatuses = new Set(["cancelled", "expired", "failed"]);
    return {
      upcoming: bookings.filter((booking) => {
        if (cancelledStatuses.has(booking.status)) return false;
        if (!booking.scheduled_at) return true;
        return new Date(booking.scheduled_at) >= now;
      }),
      past: bookings.filter((booking) => {
        if (cancelledStatuses.has(booking.status)) return false;
        if (!booking.scheduled_at) return false;
        return new Date(booking.scheduled_at) < now;
      }),
      cancelled: bookings.filter((booking) => cancelledStatuses.has(booking.status)),
    };
  }, [bookings]);

  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-14 text-center dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200 dark:bg-[#071713] dark:ring-white/10">
          <Search className="h-6 w-6 text-gray-400" />
        </div>
        <h2 className="mt-4 text-base font-bold text-foreground">
          Todavía no reservaste ninguna clase.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Cuando reserves una clase particular, vas a ver acá el horario, el
          estado del pago y los datos de acceso.
        </p>
      </div>
    );
  }

  const tabs: { id: StudentBookingTab; label: string; count: number }[] = [
    { id: "upcoming", label: "Próximas", count: grouped.upcoming.length },
    { id: "past", label: "Pasadas", count: grouped.past.length },
    { id: "cancelled", label: "Canceladas", count: grouped.cancelled.length },
  ];
  const activeBookings = grouped[activeTab];
  const totalPages = Math.max(1, Math.ceil(activeBookings.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleBookings = activeBookings.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  function selectTab(tab: StudentBookingTab) {
    setActiveTab(tab);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-[var(--surface-warm)] p-1 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-accent-700 shadow-sm dark:bg-accent-300/15 dark:text-accent-100"
                  : "text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10"
              }`}
            >
              {tab.label}
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-white/10">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <section>
        {visibleBookings.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleBookings.map((booking) => (
              <StudentBookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center dark:border-white/10 dark:bg-white/[0.02]">
            <CalendarDays className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-3 text-sm font-bold text-foreground">
              No hay clases en esta categoría.
            </p>
          </div>
        )}
      </section>

      {activeBookings.length > PAGE_SIZE && (
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Página {safePage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={safePage === 1}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/10"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={safePage === totalPages}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/10"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
