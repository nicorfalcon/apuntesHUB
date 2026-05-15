"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  Clock,
  ImageIcon,
  Plus,
  Radio,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  COURSE_VIDEO_MAX_BYTES,
  COURSE_VIDEO_MAX_LABEL,
  isAllowedCourseVideoType,
} from "@/lib/backblaze/config";
import { useCourseVideoUploads } from "@/components/uploads/course-video-upload-provider";
import type { Profile } from "@/lib/database.types";

type CourseType = "curso_completo" | "repaso_final" | "resolucion_tps";

interface CourseFormProps {
  userId: string;
  profile: Partial<Profile> | null;
}

interface ModuleDraft {
  localId: string;
  title: string;
  description: string;
  durationMinutes: string;
  videoFile: File | null;
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
const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_MAX_LABEL = "5 MB";
const COURSE_STEPS = ["Información", "Módulos", "Publicación"] as const;

function createModuleDraft(): ModuleDraft {
  return {
    localId: crypto.randomUUID(),
    title: "",
    description: "",
    durationMinutes: "45",
    videoFile: null,
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

export function CourseForm({ userId, profile }: CourseFormProps) {
  const router = useRouter();
  const { startCourseVideoUploadBatch } = useCourseVideoUploads();
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
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverDragActive, setCoverDragActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
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
    "w-full rounded-xl border border-gray-200 bg-[var(--surface-warm)] px-3.5 py-2.5 text-sm text-foreground outline-none transition-[background-color,border-color,box-shadow] placeholder:text-gray-400 focus:border-accent-400 focus:bg-white focus:ring-2 focus:ring-accent-200/45 dark:border-white/15 dark:bg-white/[0.04] dark:placeholder:text-sand-300/45 dark:focus:border-accent-300 dark:focus:bg-white/[0.07] dark:focus:ring-accent-300/15";
  const selectClass = `${inputClass} appearance-none`;
  const progressPercent = ((currentStep + 1) / COURSE_STEPS.length) * 100;

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

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

  function processCoverFile(file: File) {
    setError(null);

    if (!ACCEPTED_IMAGES.includes(file.type)) {
      setError("Subí una imagen JPG, PNG o WEBP para la portada.");
      return;
    }

    if (file.size > IMAGE_MAX_BYTES) {
      setError(`La imagen de portada no puede superar ${IMAGE_MAX_LABEL}.`);
      return;
    }

    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function handleCoverDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setCoverDragActive(false);

    const file = event.dataTransfer.files?.[0] ?? null;
    if (file) processCoverFile(file);
  }

  function clearCoverFile() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
  }

  async function uploadCourseCover(file: File) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${userId}/courses/${crypto.randomUUID()}-${safeName}`;
    const supabase = createClient();

    const response = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket: "previews", path }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { token?: string; path?: string; publicUrl?: string | null; error?: string }
      | null;

    if (!response.ok || !payload?.token || !payload.path || !payload.publicUrl) {
      throw new Error(payload?.error ?? "No pudimos preparar la imagen de portada.");
    }

    const { error: uploadError } = await supabase.storage
      .from("previews")
      .uploadToSignedUrl(payload.path, payload.token, file, { upsert: true });

    if (uploadError) throw new Error(uploadError.message);

    return payload.publicUrl;
  }

  function updateModule(
    localId: string,
    field: keyof Omit<ModuleDraft, "localId" | "videoFile">,
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

  function updateModuleVideo(localId: string, file: File | null) {
    setModules((current) =>
      current.map((courseModule) =>
        courseModule.localId === localId
          ? { ...courseModule, videoFile: file }
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

  function validateMetadataStep() {
    if (form.title.trim().length < 6) {
      return "El título del curso necesita al menos 6 caracteres.";
    }
    if (!form.subject.trim() || !form.university.trim()) {
      return "Completá materia y universidad.";
    }
    return null;
  }

  function validateModulesStep() {
    for (const courseModule of modules) {
      if (courseModule.title.trim().length < 3) {
        return "Cada módulo necesita un título.";
      }
      const duration = Number(courseModule.durationMinutes);
      if (!Number.isInteger(duration) || duration <= 0) {
        return "Cada módulo necesita una duración válida.";
      }
      if (courseModule.videoFile) {
        if (!isAllowedCourseVideoType(courseModule.videoFile.type)) {
          return "Subí videos MP4, WebM o MOV.";
        }
        if (courseModule.videoFile.size > COURSE_VIDEO_MAX_BYTES) {
          return `Cada video debe pesar como máximo ${COURSE_VIDEO_MAX_LABEL}.`;
        }
      }
    }
    return null;
  }

  function validatePublishStep() {
    const price = Number(form.price);
    if (!Number.isInteger(price) || price <= 0) {
      return "Ingresá un precio válido.";
    }
    if (form.isPublished) {
      const missingVideo = modules.some((courseModule) => !courseModule.videoFile);
      if (missingVideo) {
        return "Para publicar ahora, cada módulo necesita tener su video.";
      }
    }
    return null;
  }

  function validateForm() {
    return validateMetadataStep() ?? validateModulesStep() ?? validatePublishStep();
  }

  function currentStepError() {
    if (currentStep === 0) return validateMetadataStep();
    if (currentStep === 1) return validateModulesStep();
    return validatePublishStep();
  }

  function canAdvance() {
    return currentStepError() === null;
  }

  function nextStep() {
    const validationError = currentStepError();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setCurrentStep((step) => Math.min(step + 1, COURSE_STEPS.length - 1));
  }

  function prevStep() {
    setError(null);
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentStep < COURSE_STEPS.length - 1) return;
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      if (validateMetadataStep()) setCurrentStep(0);
      else if (validateModulesStep()) setCurrentStep(1);
      return;
    }

    setLoading(true);
    const modulesWithVideo = modules.filter((courseModule) => courseModule.videoFile);
    let coverImageUrl: string | null = null;

    if (coverFile) {
      try {
        coverImageUrl = await uploadCourseCover(coverFile);
      } catch (err) {
        setError("Error al subir la portada: " + (err as Error).message);
        setLoading(false);
        return;
      }
    }

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
        cover_image_url: coverImageUrl,
        price_ars: Number(form.price),
        is_published: form.isPublished && modulesWithVideo.length === 0,
        modules: modules.map((courseModule) => ({
          client_id: courseModule.localId,
          title: courseModule.title.trim(),
          description: courseModule.description.trim() || null,
          duration_minutes: Number(courseModule.durationMinutes),
        })),
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          course_id?: string;
          modules?: { id: string; client_id: string | null }[];
          error?: string;
        }
      | null;

    if (!response.ok || !payload?.course_id) {
      setError(payload?.error ?? "No pudimos crear el curso.");
      setLoading(false);
      return;
    }

    const createdModulesByClientId = new Map(
      (payload.modules ?? [])
        .filter((courseModule) => courseModule.client_id)
        .map((courseModule) => [courseModule.client_id, courseModule.id])
    );

    if (modulesWithVideo.length > 0) {
      const uploadItems = [];

      for (let index = 0; index < modulesWithVideo.length; index += 1) {
        const courseModule = modulesWithVideo[index];
        const moduleId = createdModulesByClientId.get(courseModule.localId);
        if (!moduleId || !courseModule.videoFile) {
          setError("El curso se creó, pero no pudimos asociar un video con su módulo.");
          setLoading(false);
          return;
        }

        uploadItems.push({
          moduleId,
          file: courseModule.videoFile,
          label: `${courseModule.title || `Módulo ${index + 1}`}`,
        });
      }

      startCourseVideoUploadBatch({
        courseId: payload.course_id,
        courseTitle: form.title.trim(),
        publishAfterComplete: form.isPublished,
        items: uploadItems,
      });

      toast.success(
        form.isPublished
          ? "Curso creado. Los videos se están subiendo y se publicará al terminar."
          : "Curso guardado. Los videos se están subiendo en segundo plano."
      );
      router.push("/sell/dashboard");
      router.refresh();
      return;
    }

    toast.success(
      form.isPublished
        ? "Curso grabado publicado correctamente."
        : "Curso guardado como borrador."
    );
    router.push(form.isPublished ? `/cursos/${payload.course_id}` : "/sell/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-white/[0.03]">
        <div className="px-6 pb-0 pt-6 sm:px-8 sm:pt-8">
          <div className="flex items-center justify-between">
            {COURSE_STEPS.map((label, index) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300 ${
                    index < currentStep
                      ? "bg-accent-600 text-white"
                      : index === currentStep
                        ? "bg-accent-600 text-white"
                        : "bg-gray-100 text-gray-400 dark:bg-white/[0.06] dark:text-sand-300/55"
                  }`}
                >
                  {index < currentStep ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`text-xs font-medium transition-colors duration-300 ${
                    index <= currentStep
                      ? "text-accent-600 dark:text-accent-100"
                      : "text-gray-400 dark:text-sand-300/55"
                  }`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-accent-600 transition-[width] duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <section className={currentStep === 0 ? "block" : "hidden"}>
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
          <div className="md:col-span-2">
            <FieldLabel htmlFor="course-cover-image">Preview del curso</FieldLabel>
            <div className="grid gap-4 rounded-2xl border border-gray-200/80 bg-[var(--surface-warm)] p-3 dark:border-white/10 dark:bg-white/[0.035] lg:grid-cols-[minmax(0,1fr)_280px]">
              <div
                className="relative min-h-[230px] overflow-hidden rounded-xl border border-white/20 bg-accent-900 text-white"
                style={{
                  backgroundColor: form.coverColor,
                  backgroundImage: coverPreview
                    ? `linear-gradient(0deg, rgba(0,0,0,.44), rgba(0,0,0,.08)), url(${coverPreview})`
                    : undefined,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }}
              >
                {!coverPreview && (
                  <>
                    <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,.22),transparent_28%),linear-gradient(135deg,rgba(255,255,255,.16)_0_1px,transparent_1px)] [background-size:auto,24px_24px]" />
                    <div className="absolute right-5 top-5 h-20 w-20 rounded-2xl border border-white/15 bg-white/10" />
                  </>
                )}
                <div className="absolute left-4 top-4 rounded-full bg-white/14 px-3 py-1 text-xs font-bold backdrop-blur">
                  {COURSE_TYPES.find((type) => type.value === form.courseType)?.label}
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="max-w-[18rem] text-2xl font-bold leading-tight text-white">
                    {form.title.trim() || "Tu curso grabado"}
                  </p>
                  <p className="mt-2 max-w-xs text-sm leading-5 text-white/80">
                    {(form.subject.trim() || "Materia") +
                      " · " +
                      (form.university.trim() || "Universidad")}
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Imagen de portada
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Se usa en Explorar, la página del curso y Mi biblioteca.
                  </p>

                  <label
                    htmlFor="course-cover-image"
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setCoverDragActive(true);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setCoverDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setCoverDragActive(false);
                    }}
                    onDrop={handleCoverDrop}
                    className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
                      coverDragActive
                        ? "border-accent-400 bg-accent-50 dark:bg-accent-300/10"
                        : "border-gray-200 bg-white hover:border-accent-300 hover:bg-accent-50/50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-300/40 dark:hover:bg-accent-300/10"
                    }`}
                  >
                    {coverPreview ? (
                      <ImageIcon className="h-5 w-5 text-accent-700 dark:text-accent-100" />
                    ) : (
                      <Upload className="h-5 w-5 text-accent-700 dark:text-accent-100" />
                    )}
                    <span className="mt-2 text-sm font-semibold text-foreground">
                      {coverFile ? coverFile.name : "Subir imagen"}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      JPG, PNG o WEBP · hasta {IMAGE_MAX_LABEL}
                    </span>
                    <input
                      id="course-cover-image"
                      type="file"
                      accept={ACCEPTED_IMAGES.join(",")}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        event.target.value = "";
                        if (file) processCoverFile(file);
                      }}
                    />
                  </label>

                  {coverFile && (
                    <button
                      type="button"
                      onClick={clearCoverFile}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-red-600 dark:hover:text-red-200"
                    >
                      <X className="h-3.5 w-3.5" />
                      Quitar imagen seleccionada
                    </button>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Color de respaldo
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COVER_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Usar color ${color}`}
                        onClick={() =>
                          setForm((current) => ({ ...current, coverColor: color }))
                        }
                        className={`h-9 w-9 rounded-lg border-2 ${
                          form.coverColor === color
                            ? "border-accent-600 dark:border-accent-100"
                            : "border-white/80 dark:border-white/20"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
          </section>

          <section className={currentStep === 1 ? "block" : "hidden"}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <SectionTitle
            icon="modules"
            title="Módulos"
            description={`Cargá la estructura y el video de cada clase. Máximo ${COURSE_VIDEO_MAX_LABEL} por módulo.`}
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
              className="rounded-2xl border border-gray-200/70 bg-[var(--surface-warm)] p-4 dark:border-white/10 dark:bg-white/[0.035]"
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
                <div className="md:col-span-2">
                  <FieldLabel htmlFor={`module-video-${courseModule.localId}`}>
                    Video de la clase
                  </FieldLabel>
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-4 py-5 text-center transition-colors hover:border-accent-300 hover:bg-accent-50/40 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-300/40 dark:hover:bg-accent-300/10">
                    <Upload className="h-5 w-5 text-accent-700 dark:text-accent-100" />
                    <span className="text-sm font-semibold text-foreground">
                      {courseModule.videoFile
                        ? courseModule.videoFile.name
                        : "Seleccionar video"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      MP4, WebM o MOV · hasta {COURSE_VIDEO_MAX_LABEL}
                    </span>
                    <input
                      id={`module-video-${courseModule.localId}`}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        if (file && file.size > COURSE_VIDEO_MAX_BYTES) {
                          setError(
                            `El video de "${courseModule.title || `Módulo ${index + 1}`}" supera ${COURSE_VIDEO_MAX_LABEL}.`
                          );
                          event.target.value = "";
                          updateModuleVideo(courseModule.localId, null);
                          return;
                        }
                        setError(null);
                        updateModuleVideo(courseModule.localId, file);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
          </section>

          <section className={currentStep === 2 ? "block" : "hidden"}>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
          <SectionTitle
            icon="publish"
            title="Publicación"
            description="Si lo publicás ahora, cada módulo necesita tener su video cargado."
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

        <div className="mt-6">
          <FieldLabel htmlFor="course-price">Precio</FieldLabel>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium text-gray-500 dark:text-sand-300/75">
              ARS
            </span>
            <input
              id="course-price"
              name="price"
              inputMode="numeric"
              value={form.price}
              onChange={handlePriceChange}
              className={`${inputClass} pl-12`}
              placeholder="30000"
            />
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
        </div>

      {error && (
        <div className="px-6 sm:px-8">
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-100">
          {error}
          </p>
        </div>
      )}

        <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 dark:text-sand-300/65">
              Paso {currentStep + 1} de {COURSE_STEPS.length}
            </span>
            {currentStep < COURSE_STEPS.length - 1 && currentStepError() && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-200/85">
                Falta: {currentStepError()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={prevStep}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30 dark:text-sand-300/70 dark:hover:bg-white/10 dark:hover:text-sand-50 dark:focus-visible:ring-accent-300/25"
              >
                Volver
              </button>
            )}

            {currentStep < COURSE_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!canAdvance()}
                className="rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !form.price}
                className="rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
              >
                {loading ? "Creando curso…" : "Crear curso grabado"}
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
