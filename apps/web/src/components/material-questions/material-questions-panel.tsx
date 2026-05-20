"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircleQuestion, Plus } from "lucide-react";
import { QuestionForm } from "./question-form";
import { QuestionThread } from "./question-thread";
import { formatSeconds, QuestionContextBadge } from "./question-context-badge";
import type { MaterialQuestionDto, MaterialTargetType } from "./types";

export function MaterialQuestionsPanel({
  targetType,
  resumeId,
  courseId,
  currentPage,
  currentModuleId,
  currentSeconds,
  onJumpToSeconds,
  className,
}: {
  targetType: MaterialTargetType;
  resumeId?: string;
  courseId?: string;
  currentPage?: number;
  currentModuleId?: string;
  currentSeconds?: number;
  onJumpToSeconds?: (seconds: number) => void;
  className?: string;
}) {
  const [questions, setQuestions] = useState<MaterialQuestionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contextLabel = useMemo(() => {
    if (targetType === "resume") return `página ${currentPage ?? 1}`;
    return `minuto ${formatSeconds(currentSeconds ?? 0)}`;
  }, [currentPage, currentSeconds, targetType]);

  const loadQuestions = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("target", targetType);
    if (targetType === "resume" && resumeId) {
      params.set("resume_id", resumeId);
      if (currentPage) params.set("page", String(currentPage));
    }
    if (targetType === "course" && courseId) {
      params.set("course_id", courseId);
      if (currentModuleId) params.set("module_id", currentModuleId);
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/material-questions?${params.toString()}`);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No pudimos cargar las consultas.");
      }

      const data = (await response.json()) as { questions: MaterialQuestionDto[] };
      setQuestions(data.questions);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "No pudimos cargar las consultas."
      );
    } finally {
      setIsLoading(false);
    }
  }, [courseId, currentModuleId, currentPage, resumeId, targetType]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const currentContextQuestions =
    targetType === "resume" && typeof currentPage === "number"
      ? questions.filter((question) => question.anchorPage === currentPage)
      : targetType === "course" && currentModuleId
        ? questions.filter((question) => question.moduleId === currentModuleId)
        : questions;

  return (
    <section className={className}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Consultas
          </p>
          <h2 className="mt-1 text-base font-bold text-foreground">
            Dudas privadas del material
          </h2>
        </div>
        <QuestionContextBadge
          page={targetType === "resume" ? currentPage : null}
          seconds={targetType === "course" ? Math.floor(currentSeconds ?? 0) : null}
          compact
        />
      </div>

      <button
        type="button"
        onClick={() => setIsFormOpen((open) => !open)}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713]"
      >
        <Plus className="h-4 w-4" />
        {targetType === "resume"
          ? `Preguntar sobre ${contextLabel}`
          : "Preguntar en este minuto"}
      </button>

      {isFormOpen && (
        <div className="mt-3">
          <QuestionForm
            targetType={targetType}
            resumeId={resumeId}
            courseId={courseId}
            moduleId={currentModuleId}
            anchorPage={targetType === "resume" ? currentPage ?? 1 : null}
            anchorSeconds={
              targetType === "course" ? Math.max(0, Math.floor(currentSeconds ?? 0)) : null
            }
            onCreated={() => {
              setIsFormOpen(false);
              void loadQuestions();
            }}
            onCancel={() => setIsFormOpen(false)}
          />
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/[0.06]"
            />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-center dark:border-white/10 dark:bg-white/[0.03]">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700 dark:bg-accent-300/10 dark:text-accent-100">
            <MessageCircleQuestion className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-bold text-foreground">
            Todavía no hay consultas.
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            La primera pregunta queda visible solo para compradores del mismo material.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {currentContextQuestions.length > 0 && currentContextQuestions.length !== questions.length && (
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              En este contexto
            </p>
          )}
          {(currentContextQuestions.length > 0 ? currentContextQuestions : questions).map(
            (question) => (
              <QuestionThread
                key={question.id}
                question={question}
                onChanged={loadQuestions}
                onJumpToSeconds={onJumpToSeconds}
              />
            )
          )}
        </div>
      )}
    </section>
  );
}
