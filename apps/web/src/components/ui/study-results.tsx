"use client";

import { RotateCcw, Sparkles, MessageSquare } from "lucide-react";

interface Props {
  correct: number;
  total: number;
  canRetryIncorrect: boolean;
  onRetryIncorrect: () => void;
  onGenerateAnother: () => void;
  onBackToChat: () => void;
}

export function StudyResults({
  correct,
  total,
  canRetryIncorrect,
  onRetryIncorrect,
  onGenerateAnother,
  onBackToChat,
}: Props) {
  const incorrect = Math.max(0, total - correct);
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6 text-center">
      <div className="flex flex-col items-center gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-sand-300/60">
          Práctica completada
        </p>
        <p className="text-4xl font-bold text-foreground">
          {correct}
          <span className="text-2xl text-gray-400 dark:text-sand-300/50">/{total}</span>
        </p>
        <p className="text-sm text-gray-500 dark:text-sand-300/70">{percent}% de aciertos</p>
      </div>

      <div className="flex w-full max-w-xs gap-3">
        <div className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-300/30 dark:bg-emerald-400/10">
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-200">{correct}</p>
          <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-300/80">Correctas</p>
        </div>
        <div className="flex-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-300/30 dark:bg-red-400/10">
          <p className="text-lg font-bold text-red-700 dark:text-red-200">{incorrect}</p>
          <p className="text-[11px] font-medium text-red-600 dark:text-red-300/80">Incorrectas</p>
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2.5">
        {canRetryIncorrect && (
          <button
            type="button"
            onClick={onRetryIncorrect}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Repetir incorrectas
          </button>
        )}
        <button
          type="button"
          onClick={onGenerateAnother}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-sand-100 dark:hover:border-white/20"
        >
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          Generar otra práctica
        </button>
        <button
          type="button"
          onClick={onBackToChat}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 dark:text-sand-300/70 dark:hover:text-sand-50"
        >
          <MessageSquare aria-hidden="true" className="h-4 w-4" />
          Volver al chat
        </button>
      </div>
    </div>
  );
}
