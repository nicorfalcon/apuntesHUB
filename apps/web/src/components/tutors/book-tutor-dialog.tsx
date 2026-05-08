"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { formatArs } from "./format";
import {
  AvailableSlotsPicker,
  type AvailableSlot,
} from "./available-slots-picker";

/* ───── Types ────────────────────────────────────────────────── */

interface BookTutorSubject {
  id: string;
  name: string;
  hourlyRate: number;
}

interface BookTutorDialogProps {
  tutorId: string;
  tutorName: string;
  subjects: BookTutorSubject[];
}

const DURATIONS = [30, 60, 90, 120] as const;

/* ───── Component ────────────────────────────────────────────── */

export function BookTutorDialog({
  tutorId,
  tutorName,
  subjects,
}: BookTutorDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Form state
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [duration, setDuration] = useState<number>(60);
  const [modality, setModality] = useState("online");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === subjectId),
    [subjectId, subjects]
  );

  const estimatedPrice = useMemo(() => {
    if (!selectedSubject) return null;
    return Math.round((selectedSubject.hourlyRate * duration) / 60);
  }, [selectedSubject, duration]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset slot when subject, duration or modality change
  useEffect(() => {
    setSelectedSlot(null);
  }, [subjectId, duration, modality]);

  async function handleBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/mercadopago/create-tutoring-preference", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tutor_id: tutorId,
          subject_id: subjectId,
          scheduled_at: selectedSlot.start,
          duration_minutes: duration,
          modality,
          initial_message: message.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.status === 401) {
        const redirect = encodeURIComponent(
          `${window.location.pathname}${window.location.hash}`
        );
        router.push(`/login?redirect=${redirect}`);
        return;
      }

      if (!res.ok || !data.initPoint) {
        setError(data.error ?? "No se pudo crear la reserva.");
        setLoading(false);
        return;
      }

      toast.success("Redirigiendo a Mercado Pago...");
      // Redirect to MercadoPago Checkout Pro
      window.location.href = data.initPoint;
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
      setLoading(false);
    }
  }

  const disabled = subjects.length === 0;

  const modal =
    mounted && open
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#0f1e1a]">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Reservar clase con {tutorName}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Elegí materia, duración y horario. Pagás a través de
                    Mercado Pago.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground dark:hover:bg-white/10"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleBooking} className="mt-6 space-y-5">
                {/* Subject */}
                <div>
                  <label
                    htmlFor="book-subject"
                    className="block text-sm font-medium text-gray-700 dark:text-sand-100"
                  >
                    Materia
                  </label>
                  <select
                    id="book-subject"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200/40 dark:border-white/15 dark:bg-white/5 dark:focus:border-accent-300 dark:focus:ring-accent-300/15"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · ${formatArs(s.hourlyRate)} / hora
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duration */}
                <div>
                  <p className="block text-sm font-medium text-gray-700 dark:text-sand-100">
                    Duración
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DURATIONS.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setDuration(val)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                          duration === val
                            ? "border-accent-600 bg-accent-600 text-white dark:border-accent-300 dark:bg-accent-300 dark:text-[#071713]"
                            : "border-gray-200 text-muted-foreground hover:bg-gray-50 hover:text-foreground dark:border-white/10 dark:hover:bg-white/5"
                        }`}
                      >
                        {val} min
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modality */}
                <div>
                  <p className="block text-sm font-medium text-gray-700 dark:text-sand-100">
                    Modalidad
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["online", "presencial"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setModality(m)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                          modality === m
                            ? "border-accent-600 bg-accent-600 text-white dark:border-accent-300 dark:bg-accent-300 dark:text-[#071713]"
                            : "border-gray-200 text-muted-foreground hover:bg-gray-50 hover:text-foreground dark:border-white/10 dark:hover:bg-white/5"
                        }`}
                      >
                        {m === "online" ? "Online" : "Presencial"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slot picker */}
                <div>
                  <p className="mb-2 block text-sm font-medium text-gray-700 dark:text-sand-100">
                    Horario disponible
                  </p>
                  <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                    <AvailableSlotsPicker
                      tutorId={tutorId}
                      durationMinutes={duration}
                      modality={modality}
                      selectedSlot={selectedSlot}
                      onSelectSlot={setSelectedSlot}
                    />
                  </div>
                </div>

                {/* Optional message */}
                <div>
                  <label
                    htmlFor="book-message"
                    className="block text-sm font-medium text-gray-700 dark:text-sand-100"
                  >
                    Mensaje al profesor{" "}
                    <span className="font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </label>
                  <textarea
                    id="book-message"
                    rows={3}
                    maxLength={1000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ej: Tengo parcial la semana que viene y quiero practicar integrales."
                    className="mt-1 w-full resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-200/40 dark:border-white/15 dark:bg-white/5 dark:placeholder:text-sand-300/45 dark:focus:border-accent-300 dark:focus:ring-accent-300/15"
                  />
                </div>

                {/* Price summary */}
                {selectedSlot && estimatedPrice !== null && (
                  <div className="rounded-xl border border-accent-200 bg-accent-50/50 p-4 dark:border-accent-300/20 dark:bg-accent-300/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {selectedSubject?.name} · {duration} min
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(selectedSlot.start).toLocaleDateString(
                            "es-AR",
                            {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              timeZone: "America/Argentina/Buenos_Aires",
                            }
                          )}{" "}
                          a las{" "}
                          {new Date(selectedSlot.start).toLocaleTimeString(
                            "es-AR",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "America/Argentina/Buenos_Aires",
                            }
                          )}
                        </p>
                      </div>
                      <p className="text-xl font-bold text-foreground">
                        ${formatArs(estimatedPrice)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-200">
                    {error}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={loading || !selectedSlot}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-60 dark:bg-accent-300 dark:text-[#071713]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CalendarCheck className="h-4 w-4" />
                        Reservar y pagar
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/15 dark:text-sand-100 dark:hover:bg-white/5"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-accent-300 dark:text-[#071713]"
      >
        <CalendarCheck className="h-4 w-4" />
        Reservar clase
      </button>
      {disabled && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Este profesor todavía no publicó materias.
        </p>
      )}
      {modal}
    </>
  );
}
