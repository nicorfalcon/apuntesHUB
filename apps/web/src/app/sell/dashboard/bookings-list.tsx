type BookingRow = {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number;
  hourly_rate_ars: number | null;
  status: string;
  subjects: { name: string } | null;
  profiles: { display_name: string | null } | null;
};

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  requested: { label: "Pendiente", class: "bg-yellow-100 text-yellow-700" },
  confirmed: { label: "Confirmada", class: "bg-blue-100 text-blue-700" },
  completed: { label: "Completada", class: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelada", class: "bg-gray-100 text-gray-600" },
};

interface BookingsListProps {
  bookings: BookingRow[];
}

export function BookingsList({ bookings }: BookingsListProps) {
  if (bookings.length === 0) {
    return (
      <p className="text-center text-sm text-gray-400">
        Todavía no recibiste solicitudes de clases.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => {
        const statusInfo =
          STATUS_LABELS[booking.status] ?? STATUS_LABELS.requested;
        const studentName = booking.profiles?.display_name ?? "Alumno";
        const subject = booking.subjects?.name ?? "Sin materia";
        const ingreso =
          ((booking.hourly_rate_ars ?? 0) * (booking.duration_minutes ?? 60)) / 60;
        const dateLabel = booking.scheduled_at
          ? new Date(booking.scheduled_at).toLocaleString("es-AR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Sin horario fijado";

        return (
          <div
            key={booking.id}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.class}`}
                >
                  {statusInfo.label}
                </span>
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {studentName}
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-gray-400">
                {subject} · {dateLabel} · {booking.duration_minutes} min
              </p>
            </div>

            {booking.status === "completed" && ingreso > 0 && (
              <div className="ml-4 flex shrink-0 items-center gap-3">
                <span className="text-sm font-bold text-accent-700">
                  ${Math.round(ingreso).toLocaleString("es-AR")}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
