"use client";

import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  GraduationCap,
  Link as LinkIcon,
  Plus,
  Trash2,
} from "lucide-react";
import type { Profile } from "@/lib/database.types";

type Modality = "online" | "presencial" | "ambas";

interface TutorFormProps {
  userId: string;
  profile: Partial<Profile> | null;
  initialSubjects?: InitialTutorSubject[];
  initialAvailability?: InitialTutorAvailability[];
}

export interface InitialTutorSubject {
  id: string;
  hourly_rate_ars: number;
  approval_proof_url: string | null;
  subjects:
    | {
        id: string;
        name: string;
        university: string;
        career: string | null;
      }
    | {
        id: string;
        name: string;
        university: string;
        career: string | null;
      }[]
    | null;
}

export interface InitialTutorAvailability {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  modality: string;
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

function createSubjectDraft(profile: Partial<Profile> | null): SubjectDraft {
  return {
    localId: "subject-0",
    name: "",
    university: profile?.university ?? "",
    career: profile?.career ?? "",
    hourlyRate: "",
    approvalProofUrl: "",
  };
}

function createAvailabilityDraft(): AvailabilityDraft {
  return {
    localId: "availability-0",
    dayOfWeek: 1,
    startTime: "18:00",
    endTime: "20:00",
    modality: "online",
  };
}

function normalizeTimeForInput(value: string) {
  return value.slice(0, 5);
}

function normalizeInitialModality(value: string): Modality {
  if (value === "presencial" || value === "ambas") return value;
  return "online";
}

function subjectFromRelation(initialSubject: InitialTutorSubject) {
  return Array.isArray(initialSubject.subjects)
    ? initialSubject.subjects[0]
    : initialSubject.subjects;
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

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-sand-100"
    >
      {children}
    </label>
  );
}

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: "profile" | "subjects" | "availability";
  title: string;
  description: string;
}) {
  const Icon = icon === "availability" ? CalendarDays : GraduationCap;

  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700 dark:bg-accent-300/10 dark:text-accent-100">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export function TutorForm({
  userId,
  profile,
  initialSubjects = [],
  initialAvailability = [],
}: TutorFormProps) {
  const router = useRouter();
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const formattedMainRate = useMemo(() => {
    const firstRate = Number(subjects[0]?.hourlyRate ?? 0);
    if (!firstRate) return "$0";
    return `$${firstRate.toLocaleString("es-AR")}`;
  }, [subjects]);

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-200/45 dark:border-white/15 dark:bg-white/5 dark:placeholder:text-sand-300/45 dark:focus:border-accent-300 dark:focus:ring-accent-300/15";
  const selectClass = `${inputClass} appearance-none`;

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

  function addSubject() {
    setSubjects((current) => [
      ...current,
      {
        ...createSubjectDraft(profile),
        localId: crypto.randomUUID(),
      },
    ]);
  }

  function removeSubject(localId: string) {
    setSubjects((current) =>
      current.length === 1
        ? current
        : current.filter((subject) => subject.localId !== localId)
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

  function addAvailability() {
    setAvailability((current) => [
      ...current,
      {
        ...createAvailabilityDraft(),
        localId: crypto.randomUUID(),
      },
    ]);
  }

  function removeAvailability(localId: string) {
    setAvailability((current) =>
      current.length === 1
        ? current
        : current.filter((slot) => slot.localId !== localId)
    );
  }

  function validateForm() {
    const trimmedBio = bio.trim();
    if (trimmedBio.length < 30) {
      return "Contá un poco más sobre cómo das clases. Mínimo 30 caracteres.";
    }

    for (const subject of subjects) {
      if (!subject.name.trim() || !subject.university.trim()) {
        return "Completá materia y universidad en todas las materias.";
      }

      const rate = Number(subject.hourlyRate);
      if (!Number.isFinite(rate) || rate <= 0) {
        return "Ingresá una tarifa por hora válida para cada materia.";
      }

      if (subject.approvalProofUrl.trim()) {
        try {
          new URL(subject.approvalProofUrl.trim());
        } catch {
          return "El comprobante debe ser un link válido.";
        }
      }
    }

    for (const slot of availability) {
      if (!slot.startTime || !slot.endTime || slot.endTime <= slot.startTime) {
        return "Revisá los horarios: cada franja tiene que terminar después de empezar.";
      }
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

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
      setLoading(false);
      return;
    }

    toast.success("Perfil de profesor publicado correctamente.");
    window.dispatchEvent(new Event("profile-updated"));
    router.push(`/tutores/${userId}`);
    router.refresh();
  }

  function handleRateChange(
    event: ChangeEvent<HTMLInputElement>,
    localId: string
  ) {
    updateSubject(localId, "hourlyRate", event.target.value.replace(/[^\d]/g, ""));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <SectionTitle
              icon="profile"
              title="Tu perfil de profesor"
              description="Este texto aparece en tu perfil público y ayuda al alumno a entender tu estilo."
            />
            <div className="mt-5">
              <FieldLabel htmlFor="tutor-bio">Biografía pública</FieldLabel>
              <textarea
                id="tutor-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={6}
                className={inputClass}
                placeholder="Ej: Doy clases enfocadas en resolver ejercicios, preparar parciales y ordenar la teoría antes del examen."
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Mínimo 30 caracteres. La verificación queda pendiente hasta que
                revisemos tu comprobante.
              </p>
            </div>
          </div>

          <aside className="rounded-2xl border border-accent-200 bg-accent-50 p-5 dark:border-accent-300/20 dark:bg-accent-300/10">
            <p className="text-xs font-bold uppercase text-accent-700 dark:text-accent-100">
              Vista rápida
            </p>
            <p className="mt-3 text-3xl font-bold text-foreground">
              {formattedMainRate}
            </p>
            <p className="text-sm text-muted-foreground">ARS / hora desde</p>
            <div className="mt-5 space-y-2 text-sm text-muted-foreground">
              <p>{subjects.length} materia{subjects.length !== 1 ? "s" : ""}</p>
              <p>
                {availability.length} horario{availability.length !== 1 ? "s" : ""} semanal{availability.length !== 1 ? "es" : ""}
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <SectionTitle
            icon="subjects"
            title="Materias que enseñás"
            description="Agregá cada materia con su precio por hora. Podés usar una tarifa distinta por materia."
          />
          <button
            type="button"
            onClick={addSubject}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent-200 px-4 py-2 text-sm font-semibold text-accent-700 transition-colors hover:bg-accent-50 dark:border-accent-300/25 dark:text-accent-100 dark:hover:bg-accent-300/10"
          >
            <Plus className="h-4 w-4" />
            Agregar materia
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {subjects.map((subject, index) => (
            <div
              key={subject.localId}
              className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.035]"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-foreground">
                  Materia {index + 1}
                </p>
                <button
                  type="button"
                  onClick={() => removeSubject(subject.localId)}
                  disabled={subjects.length === 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-red-500/10 dark:hover:text-red-200"
                  aria-label="Quitar materia"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel htmlFor={`subject-name-${subject.localId}`}>
                    Materia
                  </FieldLabel>
                  <input
                    id={`subject-name-${subject.localId}`}
                    value={subject.name}
                    onChange={(event) =>
                      updateSubject(subject.localId, "name", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Análisis Matemático I"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor={`subject-rate-${subject.localId}`}>
                    Tarifa por hora
                  </FieldLabel>
                  <input
                    id={`subject-rate-${subject.localId}`}
                    inputMode="numeric"
                    value={subject.hourlyRate}
                    onChange={(event) => handleRateChange(event, subject.localId)}
                    className={inputClass}
                    placeholder="12000"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor={`subject-university-${subject.localId}`}>
                    Universidad
                  </FieldLabel>
                  <input
                    id={`subject-university-${subject.localId}`}
                    value={subject.university}
                    onChange={(event) =>
                      updateSubject(subject.localId, "university", event.target.value)
                    }
                    className={inputClass}
                    placeholder="ITBA"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor={`subject-career-${subject.localId}`}>
                    Carrera
                  </FieldLabel>
                  <input
                    id={`subject-career-${subject.localId}`}
                    value={subject.career}
                    onChange={(event) =>
                      updateSubject(subject.localId, "career", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Ingeniería Informática"
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel htmlFor={`subject-proof-${subject.localId}`}>
                    Link al comprobante de aprobación
                  </FieldLabel>
                  <div className="relative">
                    <LinkIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id={`subject-proof-${subject.localId}`}
                      value={subject.approvalProofUrl}
                      onChange={(event) =>
                        updateSubject(
                          subject.localId,
                          "approvalProofUrl",
                          event.target.value
                        )
                      }
                      className={`${inputClass} pl-10`}
                      placeholder="https://..."
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Puede ser un link privado de Drive, certificado o analítico.
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <SectionTitle
            icon="availability"
            title="Disponibilidad semanal"
            description="Publicá franjas recurrentes. Después el horario concreto se coordina por mensaje."
          />
          <button
            type="button"
            onClick={addAvailability}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent-200 px-4 py-2 text-sm font-semibold text-accent-700 transition-colors hover:bg-accent-50 dark:border-accent-300/25 dark:text-accent-100 dark:hover:bg-accent-300/10"
          >
            <Plus className="h-4 w-4" />
            Agregar horario
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {availability.map((slot) => (
            <div
              key={slot.localId}
              className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.035]"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-foreground">Horario</p>
                <button
                  type="button"
                  onClick={() => removeAvailability(slot.localId)}
                  disabled={availability.length === 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-red-500/10 dark:hover:text-red-200"
                  aria-label="Quitar horario"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor={`slot-day-${slot.localId}`}>
                    Día
                  </FieldLabel>
                  <select
                    id={`slot-day-${slot.localId}`}
                    value={slot.dayOfWeek}
                    onChange={(event) =>
                      updateAvailability(
                        slot.localId,
                        "dayOfWeek",
                        Number(event.target.value)
                      )
                    }
                    className={selectClass}
                  >
                    {DAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel htmlFor={`slot-modality-${slot.localId}`}>
                    Modalidad
                  </FieldLabel>
                  <select
                    id={`slot-modality-${slot.localId}`}
                    value={slot.modality}
                    onChange={(event) =>
                      updateAvailability(
                        slot.localId,
                        "modality",
                        event.target.value as Modality
                      )
                    }
                    className={selectClass}
                  >
                    {MODALITIES.map((modality) => (
                      <option key={modality.value} value={modality.value}>
                        {modality.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel htmlFor={`slot-start-${slot.localId}`}>
                    Desde
                  </FieldLabel>
                  <input
                    id={`slot-start-${slot.localId}`}
                    type="time"
                    value={slot.startTime}
                    onChange={(event) =>
                      updateAvailability(slot.localId, "startTime", event.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor={`slot-end-${slot.localId}`}>
                    Hasta
                  </FieldLabel>
                  <input
                    id={`slot-end-${slot.localId}`}
                    type="time"
                    value={slot.endTime}
                    onChange={(event) =>
                      updateAvailability(slot.localId, "endTime", event.target.value)
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-100">
          {error}
        </div>
      )}

      <div className="flex justify-end border-t border-gray-200 pt-5 dark:border-white/10">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-600 px-6 text-sm font-bold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
        >
          {loading ? "Publicando..." : "Publicar perfil de profesor"}
        </button>
      </div>
    </form>
  );
}
