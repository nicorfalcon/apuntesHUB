"use client";

import { useState, useRef, useEffect } from "react";
import type { AIModel } from "@/hooks/use-ai-models";

interface Props {
  models: AIModel[];
  selected: AIModel;
  onChange: (model: AIModel) => void;
  onAddKey: () => void;
}

export function ModelSelector({ models, selected, onChange, onAddKey }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-white/10"
    >
      <span className="shrink-0 text-xs font-medium text-gray-400">Modelo:</span>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-lg px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
      >
        <span className="truncate">{selected.label}</span>
        <span className="shrink-0 text-gray-400" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {selected.hasWebSearch && (
        <span
          className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
          title="Este modelo puede buscar en internet"
        >
          🌐 Web
        </span>
      )}

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-white/15 dark:bg-[#0f1e1a]"
        >
          {models.map((model) => (
            <li
              key={model.id}
              role="option"
              aria-selected={selected.id === model.id}
              onClick={() => {
                onChange(model);
                setOpen(false);
              }}
              className={`cursor-pointer px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${
                selected.id === model.id ? "bg-accent-50 dark:bg-accent-300/10" : ""
              }`}
            >
              <p className={`text-sm font-medium ${selected.id === model.id ? "text-accent-700 dark:text-accent-200" : "text-foreground"}`}>
                {model.label}
                {model.id === "platform" && (
                  <span className="ml-2 rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-semibold text-accent-700 dark:bg-accent-300/15 dark:text-accent-200">
                    Gratis
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-sand-300/60">
                {model.hasWebSearch
                  ? "Consulta el apunte + busca en internet"
                  : "Solo consulta el apunte · gratis"}
              </p>
            </li>
          ))}

          <li
            role="option"
            aria-selected={false}
            onClick={() => {
              setOpen(false);
              onAddKey();
            }}
            className="cursor-pointer border-t border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
          >
            <p className="text-sm font-medium text-accent-600 dark:text-accent-300">
              + Agregar API key
            </p>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-sand-300/60">
              Conectá tu propio modelo con búsqueda web
            </p>
          </li>
        </ul>
      )}
    </div>
  );
}
