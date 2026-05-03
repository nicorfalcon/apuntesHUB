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
  BookOpen,
  Clock,
  Lock,
  Plus,
  Radio,
  Trash2,
  Video,
} from "lucide-react";
import type { Profile } from "@/lib/database.types";

type CourseType = "curso_completo" | "repaso_final" | "resolucion_tps";

interface CourseFormProps {
  profile: Partial<Profile> | null;
}

interface ModuleDraft {
  localId: string;
  title: string;
  description: string;
  durationMinutes: string;
}

const COURSE_TYPES: { value: CourseType; label: string; description: string }[] = [
  {
    value: "curso_completo",
    label: "Curso completo",
    description: "Un recorrido ordenado por toda la materia.",
  },
  {
    value: "repaso_final",
    label: "Repaso final",
    description: "Clases enfocadas en preparar el examen.",
  },
  {
    value: "resolucion_tps",
    label: "Resolución de TPs",
    description: "Módulos prácticos con ejercicios y entregas.",
  },
];

const COVER_COLORS = ["#263833", "#4a7e6d", "#1f5f57", "#38483f", "#6c7d6f"];

function createModuleDraft(): ModuleDraft {
  return {
    localId: crypto.randomUUID(),
    title: "",
    description: "",
    durationMinutes: "45",
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
  icon: "metadata" | "modules" | "publish";
  title: string;
  description: string;
}) {
  const Icon = icon === "modules" ? Video : icon === "publish" ? Radio : BookOpen;

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

export function CourseForm({ profile }: CourseFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    courseType: "curso_completo" as CourseType,
    subject: "",
    university: profile?.university ?? "",
    career: profile?.career ?? "",
    price: "",
    coverColor: COVER_COLORS[0],
    isPublished: true,
  });
  const [modules, setModules] = useState<ModuleDraft[]>([createModuleDraft()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDurationMinutes = useMemo(
    () =>
      modules.reduce((sum, courseModule) => {
        const value = Number(courseModule.durationMinutes);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0),
    [modules]
  );

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-200/45 dark:border-white/15 dark:bg-white/5 dark:placeholder:text-sand-300/45 dark:focus:border-accent-300 dark:focus:ring-accent-300/15";
  const selectClass = `${inputClass} appearance-none`;

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handlePriceChange(event: ChangeEvent<HTMLInputElement>) {
    setForm((current) => ({
      ...current,
      price: event.target.value.replace(/[^\d]/g, ""),
    }));
  }

  function updateModule(
    localId: string,
    field: keyof Omit<ModuleDraft, "localId">,
    value: string
  ) {
    setModules((current) =>
      current.map((courseModule) =>
        courseModule.localId === localId
          ? { ...courseModule, [field]: value }
          : courseModule
      )
    );
  }

  function addModule() {
    setModules((current) => [...current, createModuleDraft()]);
  }

  function removeModule(localId: string) {
    setModules((current) =>
      current.length === 1
        ? current
        : current.filter((courseModule) => courseModule.localId !== localId)
    );
  }

  function validateForm() {
    if (form.title.trim().length < 6) {
      return "El título del curso necesita al menos 6 caracteres.";
    }
    if (!form.subject.trim() || !form.university.trim()) {
      return "Completá materia y universidad.";
    }
    const price = Number(form.price);
    if (!Number.isInteger(price) || price <= 0) {
      return "Ingresá un precio válido.";
    }
    for (const courseModule of modules) {
      if (courseModule.title.trim().length < 3) {
        return "Cada módulo necesita un título.";
      }
      const duration = Number(courseModule.durationMinutes);
      if (!Number.isInteger(duration) || duration <= 0) {
        return "Cada módulo necesita una duración válida.";
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

    const response = await fetch("/api/courses/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || null,
        course_type: form.courseType,
        subject: {
          name: form.subject.trim(),
          university: form.university.trim(),
          career: form.career.trim() || null,
        },
        cover_color: form.coverColor,
        price_ars: Number(form.price),
        is_published: form.isPublished,
        modules: modules.map((courseModule) => ({
          title: courseModule.title.trim(),
          description: courseModule.description.trim() || null,
          duration_minutes: Number(courseModule.durationMinutes),
        })),
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { course_id?: string; error?: string }
      | null;

    if (!response.ok || !payload?.course_id) {
      setError(payload?.error ?? "No pudimos crear el curso.");
      setLoading(false);
      return;
    }

    toast.success("Curso grabado publicado correctamente.");
    router.push(`/cursos/${payload.course_id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <SectionTitle
          icon="metadata"
          title="Datos del curso"
          description="Definí el título, materia, tipo de curso y cómo se va a ver en el catálogo."
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <FieldLabel htmlFor="course-title">Título</FieldLabel>
            <input
              id="course-title"
              name="title"
              value={form.title}
              onChange={handleChange}
              className={inputClass}
              placeholder="Lógica proposicional desde cero"
            />
          </div>
          <div className="md:col-span-2">
            <FieldLabel htmlFor="course-description">Descripción</FieldLabel>
            <textarea
              id="course-description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              className={inputClass}
              placeholder="Contá qué temas cubre, para quién es y qué va a poder resolver el alumno al terminar."
            />
          </div>
          <div>
            <FieldLabel htmlFor="course-type">Tipo</FieldLabel>
            <select
              id="course-type"
              name="courseType"
              value={form.courseType}
              onChange={handleChange}
              className={selectClass}
            >
              {COURSE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              {
                COURSE_TYPES.find((type) => type.value === form.courseType)
                  ?.description
              }
            </p>
          </div>
          <div>
            <FieldLabel htmlFor="course-price">Precio</FieldLabel>
            <input
              id="course-price"
              name="price"
              inputMode="numeric"
              value={form.price}
              onChange={handlePriceChange}
              className={inputClass}
              placeholder="30000"
            />
          </div>
          <div>
            <FieldLabel htmlFor="course-subject">Materia</FieldLabel>
            <input
              id="course-subject"
              name="subject"
              value={form.subject}
              onChange={handleChange}
              className={inputClass}
              placeholder="Álgebra"
            />
          </div>
          <div>
            <FieldLabel htmlFor="course-university">Universidad</FieldLabel>
            <input
              id="course-university"
              name="university"
              value={form.university}
              onChange={handleChange}
              className={inputClass}
              placeholder="ITBA"
            />
          </div>
          <div>
            <FieldLabel htmlFor="course-career">Carrera</FieldLabel>
            <input
              id="course-career"
              name="career"
              value={form.career}
              onChange={handleChange}
              className={inputClass}
              placeholder="Ingeniería Informática"
            />
          </div>
          <div>
            <FieldLabel htmlFor="course-cover">Color de portada</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {COVER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Usar color ${color}`}
                  onClick={() =>
                    setForm((current) => ({ ...current, coverColor: color }))
                  }
                  className={`h-10 w-10 rounded-full border-2 ${
                    form.coverColor === color
                      ? "border-accent-600 dark:border-accent-100"
                      : "border-white/70 dark:border-white/20"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <SectionTitle
            icon="modules"
            title="Módulos"
            description="Cargá la estructura del curso. El upload de video queda desactivado hasta BackBlaze."
          />
          <button
            type="button"
            onClick={addModule}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent-200 px-4 py-2 text-sm font-semibold text-accent-700 transition-colors hover:bg-accent-50 dark:border-accent-300/25 dark:text-accent-100 dark:hover:bg-accent-300/10"
          >
            <Plus className="h-4 w-4" />
            Agregar módulo
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {modules.map((courseModule, index) => (
            <div
              key={courseModule.localId}
              className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.035]"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-foreground">
                  Módulo {index + 1}
                </p>
                <button
                  type="button"
                  onClick={() => removeModule(courseModule.localId)}
                  disabled={modules.length === 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-red-500/10 dark:hover:text-red-200"
                  aria-label="Quitar módulo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
                <div>
                  <FieldLabel htmlFor={`module-title-${courseModule.localId}`}>
                    Título
                  </FieldLabel>
                  <input
                    id={`module-title-${courseModule.localId}`}
                    value={courseModule.title}
                    onChange={(event) =>
                      updateModule(courseModule.localId, "title", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Tablas de verdad y conectores"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor={`module-duration-${courseModule.localId}`}>
                    Duración
                  </FieldLabel>
                  <input
                    id={`module-duration-${courseModule.localId}`}
                    inputMode="numeric"
                    value={courseModule.durationMinutes}
                    onChange={(event) =>
                      updateModule(
                        courseModule.localId,
                        "durationMinutes",
                        event.target.value.replace(/[^\d]/g, "")
                      )
                    }
                    className={inputClass}
                    placeholder="45"
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel htmlFor={`module-description-${courseModule.localId}`}>
                    Descripción
                  </FieldLabel>
                  <textarea
                    id={`module-description-${courseModule.localId}`}
                    value={courseModule.description}
                    onChange={(event) =>
                      updateModule(
                        courseModule.localId,
                        "description",
                        event.target.value
                      )
                    }
                    rows={2}
                    className={inputClass}
                    placeholder="Qué se ve en esta clase."
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-gray-200 px-3 py-2 text-xs text-muted-foreground dark:border-white/10">
                <Lock className="h-4 w-4" />
                Upload de video próximamente
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
          <SectionTitle
            icon="publish"
            title="Publicación"
            description="Podés publicarlo ahora con módulos mock. El video real se suma en la etapa de BackBlaze."
          />
          <div className="rounded-2xl border border-accent-200 bg-accent-50 p-4 dark:border-accent-300/20 dark:bg-accent-300/10">
            <p className="text-xs font-bold uppercase text-accent-700 dark:text-accent-100">
              Resumen
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {modules.length} módulo{modules.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {totalDurationMinutes} min estimados
            </p>
          </div>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-xl border border-gray-200 p-4 dark:border-white/10">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isPublished: event.target.checked,
              }))
            }
            className="mt-1 h-4 w-4 rounded border-gray-300 text-accent-600"
          />
          <span>
            <span className="block text-sm font-semibold text-foreground">
              Publicar en el catálogo
            </span>
            <span className="mt-1 block text-sm leading-5 text-muted-foreground">
              Si lo desactivás, el curso queda como borrador visible solo para
              vos por ahora.
            </span>
          </span>
        </label>
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
          {loading ? "Creando curso..." : "Crear curso grabado"}
        </button>
      </div>
    </form>
  );
}
