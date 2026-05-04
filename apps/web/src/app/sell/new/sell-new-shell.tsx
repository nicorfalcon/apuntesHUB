"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  GraduationCap,
  PlayCircle,
} from "lucide-react";
import { ResumeForm } from "../resume-form";
import {
  TutorForm,
  type InitialTutorAvailability,
  type InitialTutorSubject,
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
  id: SellType;
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
    detail: "Pensado para clases pregrabadas, repasos finales o resolución de TPs.",
    icon: PlayCircle,
  },
  {
    id: "profesores",
    title: "Publicitar clases particulares",
    description: "Materias, tarifa y disponibilidad.",
    detail: "Mostrá tu perfil para que alumnos te contacten y coordinen clases.",
    icon: GraduationCap,
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

export function SellNewShell({
  userId,
  profile,
  initialTutorSubjects,
  initialAvailability,
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

  if (!selectedType || !selectedItem) {
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
            Publicá material de estudio, un curso grabado o tus clases
            particulares desde un único lugar.
          </p>
        </header>

        <section
          aria-label="Tipo de publicación"
          className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]"
        >
          <SelectionCard
            item={SELL_TYPES[0]}
            featured
            onSelect={() => selectType(SELL_TYPES[0].id)}
          />
          <div className="grid gap-4">
            {SELL_TYPES.slice(1).map((item) => (
              <SelectionCard
                key={item.id}
                item={item}
                onSelect={() => selectType(item.id)}
              />
            ))}
          </div>
        </section>
      </div>
    );
  }

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
        {selectedType === "profesores" && (
          <TutorForm
            userId={userId}
            profile={profile}
            initialSubjects={initialTutorSubjects}
            initialAvailability={initialAvailability}
          />
        )}
        {selectedType === "curso" && <CourseForm userId={userId} profile={profile} />}
      </div>
    </div>
  );
}
