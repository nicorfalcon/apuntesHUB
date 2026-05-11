"use client";

import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  CalendarDays,
  Check,
  Clock,
  GraduationCap,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { BlockedSlotsManager } from "@/components/tutors/blocked-slots-manager";
import { formatDay, formatModality, formatTime } from "@/components/tutors/format";
import { BookingsList } from "@/app/sell/dashboard/bookings-list";
import type {
  InitialTutorAvailability,
  InitialTutorSubject,
} from "@/app/sell/tutor-form";
import type { Profile } from "@/lib/database.types";

type TeacherTab = "profile" | "subjects" | "availability" | "blocks" | "bookings";
type Modality = "online" | "presencial" | "ambas";

type BookingRow = Parameters<typeof BookingsList>[0]["bookings"][number];

interface TeacherProfileWorkspaceProps {
  profile: Partial<Profile> | null;
  initialSubjects: InitialTutorSubject[];
  initialAvailability: InitialTutorAvailability[];
  bookings: BookingRow[];
}

interface SubjectDraft {
  localId: string;
  name: string;
  university: string;
  career: string;
  hourlyRate: string;
  approvalProofUrl: string;
}

interface AvailabilityDraft {
  localId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  modality: Modality;
}

const TABS: { id: TeacherTab; label: string; icon: typeof GraduationCap }[] = [
  { id: "profile", label: "Perfil", icon: GraduationCap },
  { id: "subjects", label: "Materias", icon: BookOpen },
  { id: "availability", label: "Disponibilidad", icon: CalendarDays },
  { id: "blocks", label: "Bloqueos", icon: Clock },
  { id: "bookings", label: "Clases recibidas", icon: CalendarDays },
];

const DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const MODALITIES: { value: Modality; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "presencial", label: "Presencial" },
  { value: "ambas", label: "Online y presencial" },
];

function subjectFromRelation(initialSubject: InitialTutorSubject) {
  return Array.isArray(initialSubject.subjects)
    ? initialSubject.subjects[0]
    : initialSubject.subjects;
}

function normalizeTimeForInput(value: string) {
  return value.slice(0, 5);
}

function normalizeInitialModality(value: string): Modality {
  if (value === "presencial" || value === "ambas") return value;
  return "online";
}

function createSubjectDraft(profile: Partial<Profile> | null): SubjectDraft {
  return {
    localId: crypto.randomUUID(),
    name: "",
    university: profile?.university ?? "",
    career: profile?.career ?? "",
    hourlyRate: "",
    approvalProofUrl: "",
  };
}

function createAvailabilityDraft(): AvailabilityDraft {
  return {
    localId: crypto.randomUUID(),
    dayOfWeek: 1,
    startTime: "18:00",
    endTime: "20:00",
    modality: "online",
  };
}

function draftFromInitialSubject(
  initialSubject: InitialTutorSubject,
  profile: Partial<Profile> | null
): SubjectDraft {
  const subject = subjectFromRelation(initialSubject);
  return {
    localId: initialSubject.id,
    name: subject?.name ?? "",
    university: subject?.university ?? profile?.university ?? "",
    career: subject?.career ?? profile?.career ?? "",
    hourlyRate: initialSubject.hourly_rate_ars.toString(),
    approvalProofUrl: initialSubject.approval_proof_url ?? "",
  };
}

function draftFromInitialAvailability(
  initialAvailability: InitialTutorAvailability
): AvailabilityDraft {
  return {
    localId: initialAvailability.id,
    dayOfWeek: initialAvailability.day_of_week,
    startTime: normalizeTimeForInput(initialAvailability.start_time),
    endTime: normalizeTimeForInput(initialAvailability.end_time),
    modality: normalizeInitialModality(initialAvailability.modality),
  };
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-bold text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function TeacherProfileWorkspace({
  profile,
  initialSubjects,
  initialAvailability,
  bookings,
}: TeacherProfileWorkspaceProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TeacherTab>("profile");
  const [bio, setBio] = useState(profile?.tutor_bio ?? profile?.bio ?? "");
  const [subjects, setSubjects] = useState<SubjectDraft[]>(() =>
    initialSubjects.length > 0
      ? initialSubjects.map((subject) => draftFromInitialSubject(subject, profile))
      : [createSubjectDraft(profile)]
  );
  const [availability, setAvailability] = useState<AvailabilityDraft[]>(() =>
    initialAvailability.length > 0
      ? initialAvailability.map(draftFromInitialAvailability)
      : [createAvailabilityDraft()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-200/45 dark:border-white/15 dark:bg-[#071713] dark:placeholder:text-sand-300/45 dark:focus:border-accent-300 dark:focus:ring-accent-300/15";
  const minRate = useMemo(() => {
    const rates = subjects
      .map((subject) => Number(subject.hourlyRate))
      .filter((rate) => Number.isFinite(rate) && rate > 0);
    return rates.length > 0 ? Math.min(...rates) : null;
  }, [subjects]);

  function updateSubject(
    localId: string,
    field: keyof Omit<SubjectDraft, "localId">,
    value: string
  ) {
    setSubjects((current) =>
      current.map((subject) =>
        subject.localId === localId ? { ...subject, [field]: value } : subject
      )
    );
  }

  function updateAvailability(
    localId: string,
    field: keyof Omit<AvailabilityDraft, "localId">,
    value: string | number
  ) {
    setAvailability((current) =>
      current.map((slot) =>
        slot.localId === localId ? { ...slot, [field]: value } : slot
      )
    );
  }

  function validateForm() {
    if (bio.trim().length < 30) {
      return "La biografía pública debe tener al menos 30 caracteres.";
    }

    for (const subject of subjects) {
      if (!subject.name.trim() || !subject.university.trim()) {
        return "Completá materia y universidad en todas las materias.";
      }
      const rate = Number(subject.hourlyRate);
      if (!Number.isFinite(rate) || rate <= 0) {
        return "Ingresá una tarifa por hora válida para cada materia.";
      }
    }

    for (const slot of availability) {
      if (!slot.startTime || !slot.endTime || slot.endTime <= slot.startTime) {
        return "Revisá los horarios: cada franja tiene que terminar después de empezar.";
      }
    }

    return null;
  }

  async function saveTeacherProfile() {
    setError(null);
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/tutors/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: bio.trim(),
          subjects: subjects.map((subject) => ({
            name: subject.name.trim(),
            university: subject.university.trim(),
            career: subject.career.trim() || null,
            hourly_rate_ars: Number(subject.hourlyRate),
            approval_proof_url: subject.approvalProofUrl.trim() || null,
          })),
          availability: availability.map((slot) => ({
            day_of_week: slot.dayOfWeek,
            start_time: slot.startTime,
            end_time: slot.endTime,
            modality: slot.modality,
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "No pudimos guardar tu perfil de profesor.");
        return;
      }

      toast.success("Perfil de profesor guardado.");
      window.dispatchEvent(new Event("profile-updated"));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Estado
          </p>
          <p className="mt-2 text-lg font-bold text-foreground">
            {profile?.is_tutor ? "Activo" : "Sin publicar"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {profile?.is_tutor ? "Visible para alumnos." : "Guardá la configuración para activar tu perfil."}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Publicación
          </p>
          <p className="mt-2 text-lg font-bold text-foreground">
            {subjects.length} materia{subjects.length === 1 ? "" : "s"} ·{" "}
            {availability.length} horario{availability.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {minRate ? `Desde $${minRate.toLocaleString("es-AR")} ARS / hora.` : "Agregá una tarifa."}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-[var(--surface-warm)] p-1 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex min-w-max gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? "bg-white text-accent-700 shadow-sm dark:bg-accent-300/15 dark:text-accent-100"
                    : "text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-100">
          {error}
        </p>
      )}

      {activeTab === "profile" && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <h2 className="text-xl font-bold text-foreground">Perfil público</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Este texto aparece en tu perfil y ayuda a los alumnos a entender tu estilo.
          </p>
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Field label="Biografía pública" htmlFor="teacher-bio">
              <textarea
                id="teacher-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={8}
                className={inputClass}
                placeholder="Contá cómo das clases, qué temas trabajás y cómo preparás a tus alumnos."
              />
            </Field>
            <aside className="rounded-2xl border border-accent-200 bg-accent-50/70 p-4 dark:border-accent-300/20 dark:bg-accent-300/10">
              <p className="text-sm font-bold text-foreground">Vista rápida</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {bio.trim() || "Tu biografía aparecerá acá mientras editás."}
              </p>
            </aside>
          </div>
          <SaveButton saving={saving} onClick={saveTeacherProfile} />
        </section>
      )}

      {activeTab === "subjects" && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Materias</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Editá materias, precios y datos académicos sin salir de esta sección.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSubjects((current) => [...current, createSubjectDraft(profile)])}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent-200 px-4 py-2 text-sm font-bold text-accent-700 transition-colors hover:bg-accent-50 dark:border-accent-300/25 dark:text-accent-100 dark:hover:bg-accent-300/10"
            >
              <Plus className="h-4 w-4" />
              Agregar materia
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {subjects.map((subject, index) => (
              <div
                key={subject.localId}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.02]"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-foreground">Materia {index + 1}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setSubjects((current) =>
                        current.length === 1
                          ? current
                          : current.filter((item) => item.localId !== subject.localId)
                      )
                    }
                    disabled={subjects.length === 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-red-500/10 dark:hover:text-red-200"
                    aria-label="Quitar materia"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Materia" htmlFor={`teacher-subject-${subject.localId}`}>
                    <input
                      id={`teacher-subject-${subject.localId}`}
                      value={subject.name}
                      onChange={(event) => updateSubject(subject.localId, "name", event.target.value)}
                      className={inputClass}
                      placeholder="Análisis Matemático I"
                    />
                  </Field>
                  <Field label="Precio por hora" htmlFor={`teacher-rate-${subject.localId}`}>
                    <input
                      id={`teacher-rate-${subject.localId}`}
                      inputMode="numeric"
                      value={subject.hourlyRate}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        updateSubject(subject.localId, "hourlyRate", event.target.value.replace(/[^\d]/g, ""))
                      }
                      className={inputClass}
                      placeholder="12000"
                    />
                  </Field>
                  <Field label="Universidad" htmlFor={`teacher-university-${subject.localId}`}>
                    <input
                      id={`teacher-university-${subject.localId}`}
                      value={subject.university}
                      onChange={(event) => updateSubject(subject.localId, "university", event.target.value)}
                      className={inputClass}
                      placeholder="UBA"
                    />
                  </Field>
                  <Field label="Carrera" htmlFor={`teacher-career-${subject.localId}`}>
                    <input
                      id={`teacher-career-${subject.localId}`}
                      value={subject.career}
                      onChange={(event) => updateSubject(subject.localId, "career", event.target.value)}
                      className={inputClass}
                      placeholder="Ingeniería"
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <SaveButton saving={saving} onClick={saveTeacherProfile} />
        </section>
      )}

      {activeTab === "availability" && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Disponibilidad semanal</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Cada franja se muestra como día, horario y modalidad.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAvailability((current) => [...current, createAvailabilityDraft()])}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent-200 px-4 py-2 text-sm font-bold text-accent-700 transition-colors hover:bg-accent-50 dark:border-accent-300/25 dark:text-accent-100 dark:hover:bg-accent-300/10"
            >
              <Plus className="h-4 w-4" />
              Agregar franja
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {availability.map((slot) => (
              <div
                key={slot.localId}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.02]"
              >
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-bold text-foreground">
                    {formatDay(slot.dayOfWeek)} · {formatTime(slot.startTime)}-{formatTime(slot.endTime)} · {formatModality(slot.modality)}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setAvailability((current) =>
                        current.length === 1
                          ? current
                          : current.filter((item) => item.localId !== slot.localId)
                      )
                    }
                    disabled={availability.length === 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-red-500/10 dark:hover:text-red-200"
                    aria-label="Quitar horario"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Día" htmlFor={`teacher-day-${slot.localId}`}>
                    <select
                      id={`teacher-day-${slot.localId}`}
                      value={slot.dayOfWeek}
                      onChange={(event) => updateAvailability(slot.localId, "dayOfWeek", Number(event.target.value))}
                      className={inputClass}
                    >
                      {DAYS.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Desde" htmlFor={`teacher-start-${slot.localId}`}>
                    <input
                      id={`teacher-start-${slot.localId}`}
                      type="time"
                      value={slot.startTime}
                      onChange={(event) => updateAvailability(slot.localId, "startTime", event.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Hasta" htmlFor={`teacher-end-${slot.localId}`}>
                    <input
                      id={`teacher-end-${slot.localId}`}
                      type="time"
                      value={slot.endTime}
                      onChange={(event) => updateAvailability(slot.localId, "endTime", event.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Modalidad" htmlFor={`teacher-modality-${slot.localId}`}>
                    <select
                      id={`teacher-modality-${slot.localId}`}
                      value={slot.modality}
                      onChange={(event) => updateAvailability(slot.localId, "modality", event.target.value as Modality)}
                      className={inputClass}
                    >
                      {MODALITIES.map((modality) => (
                        <option key={modality.value} value={modality.value}>
                          {modality.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <SaveButton saving={saving} onClick={saveTeacherProfile} />
        </section>
      )}

      {activeTab === "blocks" && <BlockedSlotsManager />}

      {activeTab === "bookings" && (
        <BookingsList bookings={bookings} showBlockedSlots={false} />
      )}
    </div>
  );
}

function SaveButton({
  saving,
  onClick,
}: {
  saving: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mt-5 flex justify-end border-t border-gray-100 pt-4 dark:border-white/10">
      <button
        type="button"
        onClick={onClick}
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Guardar cambios
      </button>
    </div>
  );
}
