"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  PlayCircle,
} from "lucide-react";
import { ResumeForm } from "../resume-form";
import type {
  InitialTutorAvailability,
  InitialTutorSubject,
} from "../tutor-form";
import { CourseForm } from "../course-form";
import type { Profile } from "@/lib/database.types";

type SellType = "apunte" | "profesores" | "curso";

interface SellNewShellProps {
  userId: string;
  profile: Partial<Profile> | null;
  initialTutorSubjects: InitialTutorSubject[];
  initialAvailability: InitialTutorAvailability[];
}

const SELL_TYPES: {
  id: Exclude<SellType, "profesores">;
  title: string;
  description: string;
  detail: string;
  icon: typeof BookOpen;
}[] = [
  {
    id: "apunte",
    title: "Publicar apunte",
    description: "PDF, preview, materia y precio.",
    detail: "Ideal para resúmenes, guías, parciales resueltos y material de cursada.",
    icon: BookOpen,
  },
  {
    id: "curso",
    title: "Subir curso grabado",
    description: "Módulos, portada, videos y precio.",
    detail: "Pensado para lecciones pregrabadas, repasos finales o resolución de TPs.",
    icon: PlayCircle,
  },
];

function normalizeSellType(value: string | null): SellType | null {
  if (value === "apunte" || value === "profesores" || value === "curso") {
    return value;
  }
  return null;
}

function SelectionCard({
  item,
  featured = false,
  onSelect,
}: {
  item: (typeof SELL_TYPES)[number];
  featured?: boolean;
  onSelect: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex min-h-[170px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 text-left text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-accent-300 hover:bg-accent-50/50 hover:shadow-[0_10px_30px_rgba(31,95,87,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-300/45 dark:hover:bg-accent-300/10 dark:hover:shadow-black/25 dark:focus-visible:ring-accent-300/30 ${
        featured ? "lg:min-h-[360px]" : ""
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-700 dark:bg-accent-300/15 dark:text-accent-100">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </span>
      <span>
        <span className={`${featured ? "text-2xl" : "text-lg"} block font-bold tracking-tight`}>
          {item.title}
        </span>
        <span className="mt-2 block text-sm font-medium leading-5 text-muted-foreground">
          {item.description}
        </span>
        <span className="mt-4 block max-w-md text-sm leading-6 text-muted-foreground">
          {item.detail}
        </span>
      </span>
    </button>
  );
}

function TutorSettingsMoveNotice() {
  return (
    <section className="rounded-2xl border border-accent-200 bg-accent-50/70 p-6 dark:border-accent-300/20 dark:bg-accent-300/10">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-100">
          Clases particulares
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
          La configuración de clases ahora se gestiona desde Perfil de profesor.
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Vender queda enfocado en apuntes y cursos grabados. Para publicar tus
          clases, editar materias, horarios y bloqueos, usá la nueva sección de
          cuenta.
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/profile/profesor"
          className="inline-flex items-center justify-center rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
        >
          Ir a Perfil de profesor
        </Link>
        <Link
          href="/sell/new"
          className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/10"
        >
          Publicar apunte o curso
        </Link>
      </div>
    </section>
  );
}

export function SellNewShell({
  userId,
  profile,
}: SellNewShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedType, setSelectedType] = useState<SellType | null>(() =>
    normalizeSellType(searchParams.get("type"))
  );

  useEffect(() => {
    setSelectedType(normalizeSellType(searchParams.get("type")));
  }, [searchParams]);

  const selectedItem = useMemo(
    () => SELL_TYPES.find((item) => item.id === selectedType) ?? null,
    [selectedType]
  );

  const selectedCopy = useMemo(() => {
    if (selectedType === "profesores") {
      return {
        title: "Publicitar clases particulares",
        description:
          "Cargá tus materias, tarifa por hora y disponibilidad semanal.",
      };
    }

    if (selectedType === "curso") {
      return {
        title: "Subir curso o clase grabada",
        description: "Prepará módulos, portada, videos y precio.",
      };
    }

    return {
      title: "Publicar apunte",
      description: "Completá los datos de tu resumen y subí el archivo PDF.",
    };
  }, [selectedType]);

  function selectType(type: SellType) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("type", type);
    setSelectedType(type);
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }

  function clearType() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("type");
    setSelectedType(null);
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }

  if (!selectedType || (!selectedItem && selectedType !== "profesores")) {
    return (
      <div className="space-y-8">
        <header className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-100">
            Vender
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            ¿Qué querés publicar?
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Publicá material de estudio o cursos grabados para compartirlos con la
            comunidad.
          </p>
        </header>

        <section
          aria-label="Tipo de publicación"
          className="grid gap-4 md:grid-cols-2"
        >
          {SELL_TYPES.map((item) => (
            <SelectionCard
              key={item.id}
              item={item}
              onSelect={() => selectType(item.id)}
            />
          ))}
        </section>
      </div>
    );
  }

  if (selectedType === "profesores") {
    return (
      <div className="space-y-6">
        <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-white/[0.03] sm:p-6">
          <button
            type="button"
            onClick={clearType}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:bg-gray-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 dark:hover:bg-white/10 dark:focus-visible:ring-accent-300/30"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Vender
          </button>
        </header>
        <TutorSettingsMoveNotice />
      </div>
    );
  }

  if (!selectedItem) return null;

  const SelectedIcon = selectedItem.icon;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-white/[0.03] sm:p-6">
        <button
          type="button"
          onClick={clearType}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:bg-gray-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 dark:hover:bg-white/10 dark:focus-visible:ring-accent-300/30"
        >
          <ArrowLeft className="h-4 w-4" />
          Elegir otra publicación
        </button>
        <div className="mt-5 flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700 dark:bg-accent-300/10 dark:text-accent-100">
            <SelectedIcon className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {selectedCopy.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {selectedCopy.description}
            </p>
          </div>
        </div>
      </header>

      <div>
        {selectedType === "apunte" && <ResumeForm userId={userId} />}
        {selectedType === "curso" && <CourseForm userId={userId} profile={profile} />}
      </div>
    </div>
  );
}
