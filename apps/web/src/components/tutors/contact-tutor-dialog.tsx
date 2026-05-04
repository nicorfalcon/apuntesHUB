"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { formatArs } from "./format";

interface ContactTutorSubject {
  id: string;
  name: string;
  hourlyRate: number;
}

interface ContactTutorDialogProps {
  tutorId: string;
  tutorName: string;
  subjects: ContactTutorSubject[];
}

const DURATIONS = [60, 90, 120] as const;

export function ContactTutorDialog({
  tutorId,
  tutorName,
  subjects,
}: ContactTutorDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [duration, setDuration] = useState<number>(60);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === subjectId),
    [subjectId, subjects]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/tutors/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tutor_id: tutorId,
        subject_id: subjectId,
        duration_minutes: duration,
        message,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      booking_id?: string;
      error?: string;
    };

    if (response.status === 401) {
      const redirect = encodeURIComponent(
        `${window.location.pathname}${window.location.hash}`
      );
      router.push(`/login?redirect=${redirect}`);
      return;
    }

    if (!response.ok || !data.booking_id) {
      setError(data.error ?? "No pudimos enviar la solicitud.");
      setLoading(false);
      return;
    }

    toast.success("Solicitud enviada.");
    setOpen(false);
    router.push(`/mensajes?booking=${data.booking_id}`);
    router.refresh();
  }

  const disabled = subjects.length === 0;

  const modal =
    mounted && open
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
            onClick={(event) => event.target === event.currentTarget && setOpen(false)}
          >
            <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#0f1e1a]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Contactar a {tutorName}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Contale qué necesitás preparar. El profesor recibe tu mensaje
                    como una solicitud pendiente.
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

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="tutor-subject"
                    className="block text-sm font-medium text-gray-700 dark:text-sand-100"
                  >
                    Materia
                  </label>
                  <select
                    id="tutor-subject"
                    value={subjectId}
                    onChange={(event) => setSubjectId(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200/40 dark:border-white/15 dark:bg-white/5 dark:focus:border-accent-300 dark:focus:ring-accent-300/15"
                  >
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name} · ${formatArs(subject.hourlyRate)} / hora
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="block text-sm font-medium text-gray-700 dark:text-sand-100">
                    Duración estimada
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DURATIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDuration(value)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                          duration === value
                            ? "border-accent-600 bg-accent-600 text-white dark:border-accent-300 dark:bg-accent-300 dark:text-[#071713]"
                            : "border-gray-200 text-muted-foreground hover:bg-gray-50 hover:text-foreground dark:border-white/10 dark:hover:bg-white/5"
                        }`}
                      >
                        {value} min
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="initial-message"
                    className="block text-sm font-medium text-gray-700 dark:text-sand-100"
                  >
                    Mensaje inicial
                  </label>
                  <textarea
                    id="initial-message"
                    required
                    minLength={10}
                    maxLength={1000}
                    rows={5}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Ej: Tengo parcial la semana que viene y quiero practicar ejercicios de límites e integrales."
                    className="mt-1 w-full resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-200/40 dark:border-white/15 dark:bg-white/5 dark:placeholder:text-sand-300/45 dark:focus:border-accent-300 dark:focus:ring-accent-300/15"
                  />
                  {selectedSubject && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Tarifa de referencia: ${formatArs(selectedSubject.hourlyRate)} ARS / hora.
                    </p>
                  )}
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-200">
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-lg bg-accent-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-60 dark:bg-accent-300 dark:text-[#071713]"
                  >
                    {loading ? "Enviando..." : "Enviar solicitud"}
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
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-accent-300 dark:text-[#071713]"
      >
        <MessageCircle className="h-4 w-4" />
        Contactar
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

