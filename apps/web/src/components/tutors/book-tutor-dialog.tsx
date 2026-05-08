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
  const selectedModality = modality === "online" ? "Online" : "Presencial";
  const selectedSlotDate = selectedSlot
    ? new Date(selectedSlot.start).toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "America/Argentina/Buenos_Aires",
      })
    : null;
  const selectedSlotTime = selectedSlot
    ? new Date(selectedSlot.start).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Argentina/Buenos_Aires",
      })
    : null;

  const modal =
    mounted && open
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 px-3 py-3 backdrop-blur-[2px] sm:items-center sm:px-4"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0f1e1a]">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-4 py-4 dark:border-white/10 sm:px-6">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    Reservar clase con {tutorName}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Elegí materia, modalidad y un horario real disponible. El pago
                    se completa con Mercado Pago.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:hover:bg-white/10 dark:focus-visible:ring-accent-300"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form
                onSubmit={handleBooking}
                className="min-h-0 flex-1 overflow-y-auto"
              >
                <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
                  <div className="space-y-5">
                    <div className="grid gap-4 rounded-2xl border border-gray-200 bg-gray-50/60 p-4 dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="book-subject"
                          className="block text-sm font-semibold text-gray-800 dark:text-sand-100"
                        >
                          Materia
                        </label>
                        <select
                          id="book-subject"
                          value={subjectId}
                          onChange={(e) => setSubjectId(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-foreground outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200/40 dark:border-white/15 dark:bg-[#071713] dark:focus:border-accent-300 dark:focus:ring-accent-300/15"
                        >
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} · ${formatArs(s.hourlyRate)} / hora
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <p className="block text-sm font-semibold text-gray-800 dark:text-sand-100">
                          Duración
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {DURATIONS.map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setDuration(val)}
                              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:focus-visible:ring-accent-300 ${
                                duration === val
                                  ? "border-accent-600 bg-accent-600 text-white dark:border-accent-300 dark:bg-accent-300 dark:text-[#071713]"
                                  : "border-gray-200 bg-white text-muted-foreground hover:bg-gray-50 hover:text-foreground dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/5"
                              }`}
                            >
                              {val} min
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="block text-sm font-semibold text-gray-800 dark:text-sand-100">
                          Modalidad
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {(["online", "presencial"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setModality(m)}
                              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:focus-visible:ring-accent-300 ${
                                modality === m
                                  ? "border-accent-600 bg-accent-600 text-white dark:border-accent-300 dark:bg-accent-300 dark:text-[#071713]"
                                  : "border-gray-200 bg-white text-muted-foreground hover:bg-gray-50 hover:text-foreground dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/5"
                              }`}
                            >
                              {m === "online" ? "Online" : "Presencial"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="block text-sm font-semibold text-gray-800 dark:text-sand-100">
                            Elegí día y horario
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Primero elegí un día. Después seleccioná uno de los
                            horarios disponibles para ese día.
                          </p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4 dark:border-white/10 dark:bg-white/[0.02]">
                        <AvailableSlotsPicker
                          tutorId={tutorId}
                          durationMinutes={duration}
                          modality={modality}
                          selectedSlot={selectedSlot}
                          onSelectSlot={setSelectedSlot}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="book-message"
                        className="block text-sm font-semibold text-gray-800 dark:text-sand-100"
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
                        className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-200/40 dark:border-white/15 dark:bg-[#071713] dark:placeholder:text-sand-300/45 dark:focus:border-accent-300 dark:focus:ring-accent-300/15"
                      />
                    </div>
                  </div>

                  <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-white/[0.03] lg:sticky lg:top-0">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-700 dark:text-accent-100">
                      Resumen
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-foreground">
                      Tu reserva
                    </h3>

                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-muted-foreground">Profesor</dt>
                        <dd className="text-right font-semibold text-foreground">
                          {tutorName}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-muted-foreground">Materia</dt>
                        <dd className="text-right font-semibold text-foreground">
                          {selectedSubject?.name ?? "Elegí una materia"}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-muted-foreground">Duración</dt>
                        <dd className="text-right font-semibold text-foreground">
                          {duration} min
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-muted-foreground">Modalidad</dt>
                        <dd className="text-right font-semibold text-foreground">
                          {selectedModality}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-[#071713]">
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Horario
                        </dt>
                        <dd className="mt-1 text-sm font-semibold text-foreground">
                          {selectedSlotDate && selectedSlotTime
                            ? `${selectedSlotDate} a las ${selectedSlotTime}`
                            : "Seleccioná un horario disponible"}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-5 rounded-xl border border-accent-200 bg-accent-50/60 p-4 dark:border-accent-300/20 dark:bg-accent-300/10">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Total estimado
                      </p>
                      <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                        {estimatedPrice !== null
                          ? `$${formatArs(estimatedPrice)}`
                          : "A coordinar"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Se confirma al continuar con el pago.
                      </p>
                    </div>

                    {error && (
                      <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
                        {error}
                      </p>
                    )}

                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        type="submit"
                        disabled={loading || !selectedSlot}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-accent-300 dark:text-[#071713] dark:focus-visible:ring-accent-300 dark:focus-visible:ring-offset-[#0f1e1a]"
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
                        className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-white/15 dark:text-sand-100 dark:hover:bg-white/5 dark:focus-visible:ring-accent-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  </aside>
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
