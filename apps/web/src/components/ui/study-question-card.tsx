"use client";

import { Check, X } from "lucide-react";
import type { StudyActivity } from "@/lib/ai/study-activity";

interface Props {
  activity: StudyActivity;
  index: number;
  total: number;
  selected: number | boolean | null;
  onSelect: (value: number | boolean, isCorrect: boolean) => void;
  onNext: () => void;
  isLast: boolean;
}

function ResultBadge({ correct }: { correct: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        correct
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200"
          : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-200"
      }`}
    >
      {correct ? <Check aria-hidden="true" className="h-3 w-3" /> : <X aria-hidden="true" className="h-3 w-3" />}
      {correct ? "Correcto" : "Incorrecto"}
    </span>
  );
}

export function StudyQuestionCard({
  activity,
  index,
  total,
  selected,
  onSelect,
  onNext,
  isLast,
}: Props) {
  const answered = selected !== null;
  const question = activity.questions[index];
  const isCorrect =
    activity.type === "true_false"
      ? selected === activity.questions[index].answer
      : selected === activity.questions[index].correctOptionIndex;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700 dark:text-accent-200">
          Pregunta {index + 1} de {total}
        </p>
        <p className="truncate pl-3 text-[11px] text-gray-400 dark:text-sand-300/60">{activity.title}</p>
      </div>

      <p className="text-[15px] font-medium leading-6 text-foreground">
        {activity.type === "true_false"
          ? activity.questions[index].statement
          : activity.questions[index].question}
      </p>

      {activity.type === "true_false" ? (
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "Verdadero", value: true },
            { label: "Falso", value: false },
          ].map((option) => {
            const tf = activity.questions[index];
            const isSelected = selected === option.value;
            const showCorrect = answered && option.value === tf.answer;
            const showWrong = answered && isSelected && option.value !== tf.answer;
            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={isSelected}
                disabled={answered}
                onClick={() => onSelect(option.value, option.value === tf.answer)}
                className={`min-h-12 rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:cursor-default ${
                  showCorrect
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-300/50 dark:bg-emerald-400/10 dark:text-emerald-100"
                    : showWrong
                      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-300/50 dark:bg-red-400/10 dark:text-red-100"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 disabled:opacity-70 dark:border-white/10 dark:bg-white/[0.04] dark:text-sand-100 dark:hover:border-white/20"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {activity.questions[index].options.map((option, optionIndex) => {
            const mc = activity.questions[index];
            const isSelected = selected === optionIndex;
            const showCorrect = answered && optionIndex === mc.correctOptionIndex;
            const showWrong = answered && isSelected && optionIndex !== mc.correctOptionIndex;
            return (
              <button
                key={`${optionIndex}-${option}`}
                type="button"
                aria-pressed={isSelected}
                disabled={answered}
                onClick={() => onSelect(optionIndex, optionIndex === mc.correctOptionIndex)}
                className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:cursor-default ${
                  showCorrect
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-300/50 dark:bg-emerald-400/10 dark:text-emerald-100"
                    : showWrong
                      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-300/50 dark:bg-red-400/10 dark:text-red-100"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 disabled:opacity-70 dark:border-white/10 dark:bg-white/[0.04] dark:text-sand-100 dark:hover:border-white/20"
                }`}
              >
                <span>{option}</span>
                {showCorrect && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                {showWrong && <X aria-hidden="true" className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {answered && (
        <div className="space-y-2 rounded-xl bg-gray-50/80 p-3 text-sm leading-6 text-gray-600 dark:bg-white/[0.03] dark:text-sand-100/85">
          <ResultBadge correct={isCorrect} />
          <p>{question.explanation}</p>
          {question.sourceLabel && (
            <p className="text-xs font-medium text-gray-400 dark:text-sand-300/60">
              Fuente: {question.sourceLabel}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={!answered}
        onClick={onNext}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-40 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
      >
        {isLast ? "Ver resultados" : "Siguiente"}
      </button>
    </div>
  );
}
