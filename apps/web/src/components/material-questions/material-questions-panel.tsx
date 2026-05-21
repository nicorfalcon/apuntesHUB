"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircleQuestion, Plus, Search } from "lucide-react";
import { QuestionForm } from "./question-form";
import { QuestionThread } from "./question-thread";
import { QuestionContextBadge } from "./question-context-badge";
import type {
  MaterialQuestionDto,
  MaterialQuestionsPagination,
  MaterialTargetType,
} from "./types";

const PAGE_SIZE = 20;

type BuyerStatusFilter = "all" | "open" | "answered" | "resolved";
type BuyerSortOption = "default" | "recent" | "most_me_too";

const STATUS_FILTERS: Array<{ id: BuyerStatusFilter; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "open", label: "Pendientes" },
  { id: "answered", label: "Respondidas" },
  { id: "resolved", label: "Resueltas" },
];

const SORT_OPTIONS_BUYER: Array<{ id: BuyerSortOption; label: string }> = [
  { id: "default", label: "Sugeridas" },
  { id: "recent", label: "Recientes" },
  { id: "most_me_too", label: "Más me-too" },
];

export function MaterialQuestionsPanel({
  targetType,
  resumeId,
  courseId,
  currentPage,
  currentModuleId,
  currentSeconds,
  onJumpToSeconds,
  className,
  surface,
}: {
  targetType: MaterialTargetType;
  resumeId?: string;
  courseId?: string;
  currentPage?: number;
  currentModuleId?: string;
  currentSeconds?: number;
  onJumpToSeconds?: (seconds: number) => void;
  className?: string;
  surface?: "sidebar" | "embedded";
}) {
  const [questions, setQuestions] = useState<MaterialQuestionDto[]>([]);
  const [pagination, setPagination] = useState<MaterialQuestionsPagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BuyerStatusFilter>("all");
  const [sortOption, setSortOption] = useState<BuyerSortOption>("default");

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === searchQuery) return;
    const timer = window.setTimeout(() => setSearchQuery(trimmed), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, searchQuery]);

  const resolvedSurface = surface ?? (targetType === "course" ? "embedded" : "sidebar");
  const isEmbedded = resolvedSurface === "embedded";

  const fetchPage = useCallback(
    async (pageNumber: number) => {
      const params = new URLSearchParams();
      params.set("target", targetType);
      params.set("page", String(pageNumber));
      params.set("pageSize", String(PAGE_SIZE));
      if (targetType === "resume" && resumeId) {
        params.set("resume_id", resumeId);
        if (currentPage) params.set("current_page", String(currentPage));
      }
      if (targetType === "course" && courseId) {
        params.set("course_id", courseId);
        if (currentModuleId) params.set("module_id", currentModuleId);
      }
      if (searchQuery) params.set("q", searchQuery);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (sortOption !== "default") params.set("sort", sortOption);

      const response = await fetch(`/api/material-questions?${params.toString()}`);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No pudimos cargar las consultas.");
      }

      return (await response.json()) as {
        questions: MaterialQuestionDto[];
        pagination: MaterialQuestionsPagination;
      };
    },
    [
      courseId,
      currentModuleId,
      currentPage,
      resumeId,
      searchQuery,
      sortOption,
      statusFilter,
      targetType,
    ]
  );

  const requestSeqRef = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPage(1);
      if (requestSeqRef.current !== seq) return;
      setQuestions(data.questions);
      setPagination(data.pagination);
    } catch (loadError) {
      if (requestSeqRef.current !== seq) return;
      setQuestions([]);
      setPagination(null);
      setError(
        loadError instanceof Error ? loadError.message : "No pudimos cargar las consultas."
      );
    } finally {
      if (requestSeqRef.current === seq) setIsLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!pagination?.hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const next = pagination.page + 1;
      const data = await fetchPage(next);
      setQuestions((current) => {
        const seen = new Set(current.map((question) => question.id));
        const additions = data.questions.filter((question) => !seen.has(question.id));
        return [...current, ...additions];
      });
      setPagination(data.pagination);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "No pudimos cargar más consultas."
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchPage, isLoadingMore, pagination]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const hasActiveSearchOrFilter =
    searchQuery.length > 0 || statusFilter !== "all" || sortOption !== "default";
  const currentContextQuestions =
    hasActiveSearchOrFilter
      ? questions
      : targetType === "resume" && typeof currentPage === "number"
        ? questions.filter((question) => question.anchorPage === currentPage)
        : targetType === "course" && currentModuleId
          ? questions.filter((question) => question.moduleId === currentModuleId)
          : questions;
  const displayedQuestions =
    currentContextQuestions.length > 0 ? currentContextQuestions : questions;
  const questionCount = displayedQuestions.length;
  const headerTitle = targetType === "course" ? "Consultas del módulo" : "Consultas";
  const headerDescription =
    targetType === "course"
      ? "Preguntá sobre este video y revisá dudas de otros compradores."
      : "Dudas privadas de compradores.";
  const ctaLabel =
    targetType === "course" ? "Preguntar en este minuto" : "Preguntar sobre esta página";
  const emptyTitle =
    targetType === "course"
      ? "Todavía no hay consultas en este módulo"
      : "Todavía no hay consultas en esta página";
  const emptyDescription =
    targetType === "course"
      ? "Sé el primero en preguntar sobre este momento del video."
      : "Sé el primero en dejar una duda privada sobre esta parte del apunte.";
  const containerClass = isEmbedded
    ? "rounded-[20px] border border-gray-200 bg-white/90 p-4 shadow-[0_16px_40px_-30px_rgba(12,25,20,0.32)] dark:border-white/10 dark:bg-[#0f1e1a] sm:p-5"
    : "space-y-4";
  const ctaClass = isEmbedded
    ? "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-accent-300 dark:text-[#071713] sm:w-auto"
    : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-foreground transition-colors hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/25 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-300/25 dark:hover:bg-accent-300/10 dark:hover:text-accent-100";

  return (
    <section className={`${containerClass} ${className ?? ""}`}>
      <div
        className={
          isEmbedded
            ? "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
            : "space-y-3"
        }
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-foreground">
              {headerTitle}
            </h2>
            <QuestionContextBadge
              page={targetType === "resume" ? currentPage : null}
              seconds={targetType === "course" ? Math.floor(currentSeconds ?? 0) : null}
              compact
            />
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {headerDescription}
          </p>
          {questionCount > 0 && (
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {questionCount} consulta{questionCount === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen((open) => !open)}
          className={ctaClass}
          aria-expanded={isFormOpen}
        >
          <Plus className="h-4 w-4" />
          {ctaLabel}
        </button>
      </div>

      <div className={isEmbedded ? "mt-4 space-y-2.5" : "mt-3 space-y-2.5"}>
        <label className="relative block">
          <span className="sr-only">Buscar en consultas</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar en consultas..."
            maxLength={200}
            className="w-full rounded-xl border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-accent-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20 dark:border-white/10 dark:bg-white/[0.03] dark:focus-visible:border-accent-300/40"
          />
        </label>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id)}
              className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                statusFilter === item.id
                  ? "border-accent-300 bg-accent-50 text-accent-700 dark:border-accent-300/30 dark:bg-accent-300/10 dark:text-accent-100"
                  : "border-gray-200 text-muted-foreground hover:border-accent-200 hover:text-accent-700 dark:border-white/10"
              }`}
            >
              {item.label}
            </button>
          ))}
          <span className="mx-1 h-3.5 w-px shrink-0 bg-gray-200 dark:bg-white/10" aria-hidden />
          {SORT_OPTIONS_BUYER.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSortOption(item.id)}
              className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                sortOption === item.id
                  ? "border-accent-300 bg-accent-50 text-accent-700 dark:border-accent-300/30 dark:bg-accent-300/10 dark:text-accent-100"
                  : "border-gray-200 text-muted-foreground hover:border-accent-200 hover:text-accent-700 dark:border-white/10"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {isFormOpen && (
        <div className={isEmbedded ? "mt-4" : "mt-3"}>
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
              void loadFirstPage();
            }}
            onCancel={() => setIsFormOpen(false)}
          />
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="mt-4 space-y-2.5">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-white/[0.06]"
            />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-3 py-3.5 dark:border-white/10 dark:bg-white/[0.03] sm:flex-row sm:items-start">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-accent-700 ring-1 ring-gray-200 dark:bg-white/[0.04] dark:text-accent-100 dark:ring-white/10">
            <MessageCircleQuestion className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">
              {hasActiveSearchOrFilter ? "Sin resultados" : emptyTitle}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {hasActiveSearchOrFilter
                ? "Probá con otra búsqueda o cambiá los filtros."
                : emptyDescription}
            </p>
            {!isFormOpen && !hasActiveSearchOrFilter && (
              <button
                type="button"
                onClick={() => setIsFormOpen(true)}
                className="mt-2 text-xs font-bold text-accent-700 transition-colors hover:text-accent-800 dark:text-accent-100"
              >
                {ctaLabel}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {currentContextQuestions.length > 0 &&
            currentContextQuestions.length !== questions.length && (
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                En este contexto
              </p>
            )}
          {displayedQuestions.map((question) => (
            <QuestionThread
              key={question.id}
              question={question}
              onChanged={loadFirstPage}
              onJumpToSeconds={onJumpToSeconds}
              compact={resolvedSurface === "sidebar"}
            />
          ))}

          {pagination?.hasMore && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={isLoadingMore}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-foreground transition-colors hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-300/25 dark:hover:bg-accent-300/10 dark:hover:text-accent-100"
              >
                {isLoadingMore
                  ? "Cargando..."
                  : `Ver más consultas (${pagination.total - questions.length} restantes)`}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
