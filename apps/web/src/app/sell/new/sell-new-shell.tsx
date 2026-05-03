"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  Lock,
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
  icon: typeof BookOpen;
  disabled?: boolean;
}[] = [
  {
    id: "apunte",
    title: "Publicar apunte",
    description: "Subí un PDF, precio y datos de materia.",
    icon: BookOpen,
  },
  {
    id: "profesores",
    title: "Ofrecer clases particulares",
    description: "Armá tu perfil de profesor, materias y horarios.",
    icon: GraduationCap,
  },
  {
    id: "curso",
    title: "Subir curso grabado",
    description: "Creá un curso con módulos y videos mock.",
    icon: PlayCircle,
  },
];

function normalizeSellType(value: string | null): SellType {
  if (value === "profesores" || value === "curso") return value;
  return "apunte";
}

function SelectionCard({
  item,
  active,
  onSelect,
}: {
  item: (typeof SELL_TYPES)[number];
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      disabled={item.disabled}
      aria-pressed={active}
      onClick={onSelect}
      className={`group flex min-h-[132px] flex-col justify-between rounded-2xl border p-4 text-left transition-colors ${
        active
          ? "border-accent-500 bg-accent-50 text-accent-950 dark:border-accent-300/70 dark:bg-accent-300/10 dark:text-sand-50"
          : "border-gray-200 bg-white text-foreground hover:border-accent-300 hover:bg-accent-50/60 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-300/45 dark:hover:bg-accent-300/10"
      } ${
        item.disabled
          ? "cursor-not-allowed opacity-55 hover:border-gray-200 hover:bg-white dark:hover:border-white/10 dark:hover:bg-white/[0.03]"
          : ""
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-700 dark:bg-accent-300/15 dark:text-accent-100">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
        {item.disabled ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        )}
      </span>
      <span>
        <span className="block text-base font-semibold">{item.title}</span>
        <span className="mt-1.5 block text-sm leading-5 text-muted-foreground">
          {item.description}
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
  const [selectedType, setSelectedType] = useState<SellType>(() =>
    normalizeSellType(searchParams.get("type"))
  );

  useEffect(() => {
    setSelectedType(normalizeSellType(searchParams.get("type")));
  }, [searchParams]);

  const selectedCopy = useMemo(() => {
    if (selectedType === "profesores") {
      return {
        title: "Ofrecer clases particulares",
        description:
          "Publicá tus materias, tarifa por hora y disponibilidad semanal.",
      };
    }

    if (selectedType === "curso") {
      return {
        title: "Subir curso grabado",
        description: "Prepará el espacio para vender clases pregrabadas.",
      };
    }

    return {
      title: "Publicar apunte",
      description: "Completá los datos de tu resumen y subí el archivo PDF.",
    };
  }, [selectedType]);

  function selectType(type: SellType) {
    const next = new URLSearchParams(searchParams.toString());
    if (type === "apunte") next.delete("type");
    else next.set("type", type);
    setSelectedType(type);
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground">
          {selectedCopy.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {selectedCopy.description}
        </p>
      </header>

      <section aria-label="Tipo de publicación" className="grid gap-3 md:grid-cols-3">
        {SELL_TYPES.map((item) => (
          <SelectionCard
            key={item.id}
            item={item}
            active={selectedType === item.id}
            onSelect={() => selectType(item.id)}
          />
        ))}
      </section>

      <div className={selectedType === "apunte" ? "mx-auto max-w-2xl" : ""}>
        {selectedType === "apunte" && <ResumeForm userId={userId} />}
        {selectedType === "profesores" && (
          <TutorForm
            userId={userId}
            profile={profile}
            initialSubjects={initialTutorSubjects}
            initialAvailability={initialAvailability}
          />
        )}
        {selectedType === "curso" && <CourseForm profile={profile} />}
      </div>
    </div>
  );
}
