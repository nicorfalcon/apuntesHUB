"use client";

import { ChevronDown, Search, X } from "lucide-react";
import type { FilterOption } from "./apuntes-toolbar";
import { closeOtherExploreDropdowns } from "./dropdown-utils";

export type CourseTypeFilter =
  | "curso_completo"
  | "repaso_final"
  | "resolucion_tps";
export type CourseDurationFilter = "all" | "under_2h" | "2_6h" | "over_6h";
export type CourseTypeOption = {
  value: CourseTypeFilter;
  label: string;
  count?: number;
};

interface GrabadasToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  types: CourseTypeOption[];
  subjects: FilterOption[];
  universities: FilterOption[];
  selectedTypes: Set<CourseTypeFilter>;
  selectedSubjects: Set<string>;
  selectedUniversities: Set<string>;
  duration: CourseDurationFilter;
  activeFilterCount: number;
  onToggleType: (value: CourseTypeFilter) => void;
  onToggleSubject: (value: string) => void;
  onToggleUniversity: (value: string) => void;
  onDurationChange: (value: CourseDurationFilter) => void;
  onClear: () => void;
}

const DURATION_OPTIONS: { value: CourseDurationFilter; label: string }[] = [
  { value: "all", label: "Cualquier duración" },
  { value: "under_2h", label: "Hasta 2 horas" },
  { value: "2_6h", label: "2 a 6 horas" },
  { value: "over_6h", label: "Más de 6 horas" },
];

function MultiDropdown<TValue extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: TValue; label: string; count?: number }[];
  selected: Set<TValue>;
  onToggle: (value: TValue) => void;
}) {
  return (
    <details
      className="group relative"
      data-explore-dropdown
      onToggle={closeOtherExploreDropdowns}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent-300 hover:bg-accent-50/70 dark:border-white/10 dark:bg-white/5 dark:hover:border-accent-300/35 dark:hover:bg-accent-300/10">
        <span>{label}</span>
        {selected.size > 0 && (
          <span className="rounded-full bg-accent-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {selected.size}
          </span>
        )}
        <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 top-[calc(100%+8px)] z-30 max-h-72 w-72 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-xl shadow-black/10 dark:border-white/10 dark:bg-[#0f1e1a] dark:shadow-black/35">
        {options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-gray-400">Sin opciones</p>
        ) : (
          options.map((option) => {
            const checked = selected.has(option.value);

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onToggle(option.value)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  checked
                    ? "bg-accent-50 text-accent-700 dark:bg-accent-300/15 dark:text-accent-100"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    checked
                      ? "border-accent-600 bg-accent-600"
                      : "border-gray-300 dark:border-white/20"
                  }`}
                >
                  {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-xs text-gray-400">{option.count}</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </details>
  );
}

function SingleDropdown<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: { value: TValue; label: string }[];
  onChange: (value: TValue) => void;
}) {
  const current = options.find((option) => option.value === value)?.label ?? label;

  return (
    <details
      className="group relative"
      data-explore-dropdown
      onToggle={closeOtherExploreDropdowns}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent-300 hover:bg-accent-50/70 dark:border-white/10 dark:bg-white/5 dark:hover:border-accent-300/35 dark:hover:bg-accent-300/10">
        <span>{value === "all" ? label : current}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl shadow-black/10 dark:border-white/10 dark:bg-[#0f1e1a] dark:shadow-black/35">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={(event) => {
              onChange(option.value);
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
            className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
              value === option.value
                ? "bg-accent-50 font-semibold text-accent-700 dark:bg-accent-300/15 dark:text-accent-100"
                : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </details>
  );
}

export function GrabadasToolbar({
  query,
  onQueryChange,
  types,
  subjects,
  universities,
  selectedTypes,
  selectedSubjects,
  selectedUniversities,
  duration,
  activeFilterCount,
  onToggleType,
  onToggleSubject,
  onToggleUniversity,
  onDurationChange,
  onClear,
}: GrabadasToolbarProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#0f1e1a]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar cursos grabados</span>
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar curso por materia o autor"
            className="h-12 w-full rounded-full border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:bg-white focus:ring-2 focus:ring-accent-200/50 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-gray-500 dark:focus:border-accent-300 dark:focus:bg-white/10 dark:focus:ring-accent-300/15"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <MultiDropdown
            label="Tipo"
            options={types}
            selected={selectedTypes}
            onToggle={onToggleType}
          />
          <SingleDropdown
            label="Duración"
            value={duration}
            options={DURATION_OPTIONS}
            onChange={onDurationChange}
          />
          <MultiDropdown
            label="Materia"
            options={subjects}
            selected={selectedSubjects}
            onToggle={onToggleSubject}
          />
          <MultiDropdown
            label="Universidad"
            options={universities}
            selected={selectedUniversities}
            onToggle={onToggleUniversity}
          />
          {(activeFilterCount > 0 || query.trim()) && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-foreground dark:text-gray-300 dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
              Limpiar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
