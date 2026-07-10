"use client";

import { ChevronDown, Search, Tag, X } from "lucide-react";
import { closeOtherExploreDropdowns } from "./dropdown-utils";

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export type PriceRange = "all" | "free" | "under_10000" | "10000_30000" | "over_30000";

interface ApuntesToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  universities: FilterOption[];
  careers: FilterOption[];
  subjects: FilterOption[];
  selectedUniversities: Set<string>;
  selectedCareers: Set<string>;
  selectedSubjects: Set<string>;
  priceRange: PriceRange;
  onlyDiscounted: boolean;
  activeFilterCount: number;
  onToggleUniversity: (value: string) => void;
  onToggleCareer: (value: string) => void;
  onToggleSubject: (value: string) => void;
  onPriceRangeChange: (value: PriceRange) => void;
  onOnlyDiscountedChange: (value: boolean) => void;
  onClear: () => void;
  aiSearch: boolean;
  onAiSearchChange: (value: boolean) => void;
  aiSearchLoading?: boolean;
}

const PRICE_OPTIONS: { value: PriceRange; label: string }[] = [
  { value: "all", label: "Todos los precios" },
  { value: "free", label: "Gratis" },
  { value: "under_10000", label: "Hasta $10.000" },
  { value: "10000_30000", label: "$10.000 a $30.000" },
  { value: "over_30000", label: "Más de $30.000" },
];

function MultiFilter({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  const selectedCount = selected.size;

  return (
    <details
      className="group relative"
      data-explore-dropdown
      onToggle={closeOtherExploreDropdowns}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent-300 hover:bg-accent-50/70 dark:border-white/10 dark:bg-white/5 dark:hover:border-accent-300/35 dark:hover:bg-accent-300/10">
        <span>{label}</span>
        {selectedCount > 0 && (
          <span className="rounded-full bg-accent-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {selectedCount}
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
                  {checked && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span className="text-xs text-gray-400">{option.count}</span>
              </button>
            );
          })
        )}
      </div>
    </details>
  );
}

function PriceFilter({
  value,
  onChange,
}: {
  value: PriceRange;
  onChange: (value: PriceRange) => void;
}) {
  const current = PRICE_OPTIONS.find((option) => option.value === value)?.label ?? "Precio";

  return (
    <details
      className="group relative"
      data-explore-dropdown
      onToggle={closeOtherExploreDropdowns}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent-300 hover:bg-accent-50/70 dark:border-white/10 dark:bg-white/5 dark:hover:border-accent-300/35 dark:hover:bg-accent-300/10">
        <span>{value === "all" ? "Precio" : current}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl shadow-black/10 dark:border-white/10 dark:bg-[#0f1e1a] dark:shadow-black/35">
        {PRICE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
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

export function ApuntesToolbar({
  query,
  onQueryChange,
  universities,
  careers,
  subjects,
  selectedUniversities,
  selectedCareers,
  selectedSubjects,
  priceRange,
  onlyDiscounted,
  activeFilterCount,
  onToggleUniversity,
  onToggleCareer,
  onToggleSubject,
  onPriceRangeChange,
  onOnlyDiscountedChange,
  onClear,
  aiSearch,
  onAiSearchChange,
  aiSearchLoading,
}: ApuntesToolbarProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#0f1e1a]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar apuntes</span>
          {aiSearchLoading ? (
            <span className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-accent-400 border-t-transparent" />
          ) : (
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          )}
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={
              aiSearch
                ? "Ej: principio de Le Chatelier, derivadas parciales..."
                : "Buscar apunte por tema, autor o materia"
            }
            className="h-12 w-full rounded-full border border-gray-200 bg-gray-50 pl-11 pr-[172px] text-sm text-foreground outline-none transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:bg-white focus:ring-2 focus:ring-accent-200/50 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-gray-500 dark:focus:border-accent-300 dark:focus:bg-white/10 dark:focus:ring-accent-300/15"
          />
          {/* Toggle "Buscar por tema" */}
          <button
            type="button"
            role="switch"
            aria-checked={aiSearch}
            onClick={() => onAiSearchChange(!aiSearch)}
            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex cursor-pointer items-center gap-2"
          >
            <span className={`text-xs font-medium transition-colors ${aiSearch ? "text-accent-700 dark:text-accent-300" : "text-gray-400"}`}>
              Buscar por tema
            </span>
            <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${aiSearch ? "bg-accent-500" : "bg-gray-200 dark:bg-white/20"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${aiSearch ? "translate-x-4" : "translate-x-0.5"}`} />
            </span>
          </button>
        </label>

        <div className="flex flex-wrap gap-2">
          <MultiFilter
            label="Universidad"
            options={universities}
            selected={selectedUniversities}
            onToggle={onToggleUniversity}
          />
          <MultiFilter
            label="Carrera"
            options={careers}
            selected={selectedCareers}
            onToggle={onToggleCareer}
          />
          <MultiFilter
            label="Materia"
            options={subjects}
            selected={selectedSubjects}
            onToggle={onToggleSubject}
          />
          <PriceFilter value={priceRange} onChange={onPriceRangeChange} />
          <button
            type="button"
            role="switch"
            aria-checked={onlyDiscounted}
            onClick={() => onOnlyDiscountedChange(!onlyDiscounted)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
              onlyDiscounted
                ? "border-rose-500 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-rose-200"
                : "border-gray-200 bg-white text-foreground hover:border-rose-300 hover:bg-rose-50/60 dark:border-white/10 dark:bg-white/5 dark:hover:border-rose-400/30 dark:hover:bg-rose-500/10"
            }`}
          >
            <Tag className="h-4 w-4" strokeWidth={1.9} />
            Con descuento
          </button>
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
