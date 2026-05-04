"use client";

import { ChevronDown, Search, X } from "lucide-react";
import type { FilterOption } from "./apuntes-toolbar";
import { closeOtherExploreDropdowns } from "./dropdown-utils";

export type TutorModality = "online" | "presencial" | "ambas";
export type TutorAvailabilityFilter = "all" | "weekdays" | "weekend";
export type TutorRateRange = "all" | "under_8000" | "8000_15000" | "over_15000";

interface ParticularesToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  subjects: FilterOption[];
  selectedModalities: Set<TutorModality>;
  selectedSubjects: Set<string>;
  availability: TutorAvailabilityFilter;
  rateRange: TutorRateRange;
  activeFilterCount: number;
  onToggleModality: (value: TutorModality) => void;
  onToggleSubject: (value: string) => void;
  onAvailabilityChange: (value: TutorAvailabilityFilter) => void;
  onRateRangeChange: (value: TutorRateRange) => void;
  onClear: () => void;
}

const MODALITY_OPTIONS: { value: TutorModality; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "presencial", label: "Presencial" },
  { value: "ambas", label: "Ambas" },
];

const AVAILABILITY_OPTIONS: { value: TutorAvailabilityFilter; label: string }[] = [
  { value: "all", label: "Cualquier día" },
  { value: "weekdays", label: "Entre semana" },
  { value: "weekend", label: "Fin de semana" },
];

const RATE_OPTIONS: { value: TutorRateRange; label: string }[] = [
  { value: "all", label: "Todas las tarifas" },
  { value: "under_8000", label: "Hasta $8.000" },
  { value: "8000_15000", label: "$8.000 a $15.000" },
  { value: "over_15000", label: "Más de $15.000" },
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

export function ParticularesToolbar({
  query,
  onQueryChange,
  subjects,
  selectedModalities,
  selectedSubjects,
  availability,
  rateRange,
  activeFilterCount,
  onToggleModality,
  onToggleSubject,
  onAvailabilityChange,
  onRateRangeChange,
  onClear,
}: ParticularesToolbarProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#0f1e1a]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar profesores</span>
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar profe por nombre o materia"
            className="h-12 w-full rounded-full border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:bg-white focus:ring-2 focus:ring-accent-200/50 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-gray-500 dark:focus:border-accent-300 dark:focus:bg-white/10 dark:focus:ring-accent-300/15"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <MultiDropdown
            label="Modalidad"
            options={MODALITY_OPTIONS}
            selected={selectedModalities}
            onToggle={onToggleModality}
          />
          <MultiDropdown
            label="Materia"
            options={subjects}
            selected={selectedSubjects}
            onToggle={onToggleSubject}
          />
          <SingleDropdown
            label="Disponibilidad"
            value={availability}
            options={AVAILABILITY_OPTIONS}
            onChange={onAvailabilityChange}
          />
          <SingleDropdown
            label="$/hora"
            value={rateRange}
            options={RATE_OPTIONS}
            onChange={onRateRangeChange}
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
