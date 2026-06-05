"use client";

import { GraduationCap, Sparkles } from "lucide-react";

export const PRACTICE_TYPES = [
  { value: "multiple_choice", label: "Multiple choice", hint: "Opción múltiple" },
  { value: "true_false", label: "Verdadero / Falso", hint: "Afirmaciones" },
  { value: "quiz", label: "Quiz", hint: "Preguntas abiertas" },
] as const;

export type PracticeType = (typeof PRACTICE_TYPES)[number]["value"];

export const PRACTICE_COUNTS = [3, 5] as const;
export type PracticeCount = (typeof PRACTICE_COUNTS)[number];

interface Props {
  type: PracticeType;
  onTypeChange: (type: PracticeType) => void;
  count: PracticeCount;
  onCountChange: (count: PracticeCount) => void;
  topic: string;
  onTopicChange: (topic: string) => void;
  onGenerate: () => void;
  error: string | null;
}

export function StudySetup({
  type,
  onTypeChange,
  count,
  onCountChange,
  topic,
  onTopicChange,
  onGenerate,
  error,
}: Props) {
  const supportsCount = type !== "quiz";

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-300/15 dark:text-accent-200">
          <GraduationCap aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Armá tu práctica</p>
          <p className="text-xs text-gray-400 dark:text-sand-300/60">
            Generá ejercicios sobre este apunte
          </p>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-sand-300/70">
          Tipo de práctica
        </legend>
        <div className="grid gap-2">
          {PRACTICE_TYPES.map((option) => {
            const active = type === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => onTypeChange(option.value)}
                className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 ${
                  active
                    ? "border-accent-500 bg-accent-50 dark:border-accent-300 dark:bg-accent-300/15"
                    : "border-gray-200 bg-white hover:border-gray-300 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20"
                }`}
              >
                <span
                  className={`text-sm font-semibold ${
                    active ? "text-accent-700 dark:text-accent-100" : "text-foreground"
                  }`}
                >
                  {option.label}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-sand-300/60">{option.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {supportsCount && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-sand-300/70">
            Cantidad de preguntas
          </legend>
          <div className="flex gap-2">
            {PRACTICE_COUNTS.map((option) => {
              const active = count === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onCountChange(option)}
                  className={`min-h-10 flex-1 rounded-xl border text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 ${
                    active
                      ? "border-accent-500 bg-accent-50 text-accent-700 dark:border-accent-300 dark:bg-accent-300/15 dark:text-accent-100"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-sand-100 dark:hover:border-white/20"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="study-topic"
          className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-sand-300/70"
        >
          Tema (opcional)
        </label>
        <input
          id="study-topic"
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          placeholder="Todo el apunte — o un tema: “Le Chatelier”, “Kc y Kp”…"
          className="min-h-10 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-white/15 dark:bg-white/5 dark:placeholder:text-sand-300/45 dark:focus:ring-accent-300/20"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onGenerate}
        className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
      >
        <Sparkles aria-hidden="true" className="h-4 w-4" />
        Generar práctica
      </button>
    </div>
  );
}
