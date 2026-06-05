"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { StudyChatAnswerMode } from "@/lib/ai/chat-request";

export type { StudyChatAnswerMode };

interface AnswerModeOption {
  value: StudyChatAnswerMode;
  /** Texto completo mostrado en el menú */
  label: string;
  /** Texto corto mostrado en el botón disparador */
  shortLabel: string;
  description: string;
}

// Modos conversacionales del chat. Las actividades interactivas (quiz, V/F,
// multiple choice) viven ahora en la pestaña "Estudiar", no en el hilo del chat.
export const ANSWER_MODE_OPTIONS: AnswerModeOption[] = [
  { value: "auto", label: "Auto", shortLabel: "Auto", description: "Elige el mejor formato" },
  { value: "explain", label: "Explicar", shortLabel: "Explicar", description: "Explicación clara" },
  { value: "summary", label: "Resumir", shortLabel: "Resumir", description: "Ideas centrales" },
  { value: "example", label: "Ejemplo", shortLabel: "Ejemplo", description: "Genera un ejemplo" },
  { value: "step_by_step", label: "Paso a paso", shortLabel: "Paso a paso", description: "Desglose guiado" },
  { value: "beginner", label: "Principiante", shortLabel: "Principiante", description: "Más simple" },
];

interface Props {
  value: StudyChatAnswerMode;
  onChange: (value: StudyChatAnswerMode) => void;
  disabled?: boolean;
}

export function AnswerModeSelector({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = ANSWER_MODE_OPTIONS.find((o) => o.value === value) ?? ANSWER_MODE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Modo de respuesta: ${selected.label}`}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 hover:border-gray-300 hover:text-gray-800 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-sand-200 dark:hover:border-white/20 dark:hover:text-sand-50"
      >
        <span className="text-gray-400 dark:text-sand-300/60">Modo:</span>
        <span className="text-accent-700 dark:text-accent-200">{selected.shortLabel}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 text-gray-400 transition-transform dark:text-sand-300/60 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Modo de respuesta"
          className="absolute bottom-full left-0 z-50 mb-1.5 max-h-72 w-56 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-white/15 dark:bg-[#0f1e1a] dark:shadow-black/40"
        >
          {ANSWER_MODE_OPTIONS.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-500 ${
                    active
                      ? "bg-accent-50 dark:bg-accent-300/10"
                      : "hover:bg-gray-50 dark:hover:bg-white/5"
                  }`}
                >
                  <Check
                    aria-hidden="true"
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      active ? "text-accent-600 dark:text-accent-300" : "text-transparent"
                    }`}
                  />
                  <span className="min-w-0">
                    <span
                      className={`block text-xs font-semibold ${
                        active ? "text-accent-700 dark:text-accent-200" : "text-foreground"
                      }`}
                    >
                      {option.label}
                    </span>
                    <span className="block text-[11px] text-gray-400 dark:text-sand-300/60">
                      {option.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
