"use client";

import { ChevronDown, Search } from "lucide-react";

const FILTERS = ["Tipo", "Duración", "Materia", "Universidad"];

export function GrabadasToolbar() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#0f1e1a]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar cursos grabados</span>
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            disabled
            placeholder="Buscar curso por materia o autor"
            className="h-12 w-full rounded-full border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm text-foreground outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-gray-500"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-400 opacity-75 dark:border-white/10 dark:bg-white/5 dark:text-gray-500"
            >
              {filter}
              <ChevronDown className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
