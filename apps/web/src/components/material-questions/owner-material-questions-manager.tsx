"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArchiveRestore,
  CheckCircle2,
  EyeOff,
  FileText,
  GraduationCap,
  MessageCircleReply,
  Search,
  ThumbsUp,
  Trash2,
  UserRound,
} from "lucide-react";
import { AnswerComposer } from "./answer-composer";
import { QuestionContextBadge, formatSeconds } from "./question-context-badge";
import type {
  MaterialQuestionStatus,
  MaterialQuestionsPagination,
  MaterialTargetType,
} from "./types";

export interface OwnerMaterialQuestionItem {
  id: string;
  targetType: MaterialTargetType;
  status: MaterialQuestionStatus;
  title: string;
  body: string;
  isAnonymousToBuyers: boolean;
  createdAt: string;
  anchorPage: number | null;
  anchorSeconds: number | null;
  material: {
    id: string;
    title: string;
  };
  module: {
    id: string;
    title: string;
    position: number;
  } | null;
  student: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  counts: {
    meToo: number;
    helpful: number;
    answers: number;
  };
}

export type OwnerStatusFilter =
  | "all"
  | "open"
  | "answered"
  | "resolved"
  | "hidden";
export type OwnerTargetFilter = "all" | "resume" | "course";
export type OwnerSortOption =
  | "default"
  | "recent"
  | "most_me_too"
  | "answered_first"
  | "unresolved_first";

const STATUS_FILTERS: Array<{ id: OwnerStatusFilter; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "open", label: "Pendientes" },
  { id: "answered", label: "Respondidas" },
  { id: "resolved", label: "Resueltas" },
  { id: "hidden", label: "Ocultas" },
];

const TARGET_FILTERS: Array<{ id: OwnerTargetFilter; label: string }> = [
  { id: "all", label: "Apuntes y cursos" },
  { id: "resume", label: "Apuntes" },
  { id: "course", label: "Cursos" },
];

const SORT_OPTIONS_OWNER: Array<{ id: OwnerSortOption; label: string }> = [
  { id: "default", label: "Sugeridas" },
  { id: "recent", label: "Recientes" },
  { id: "most_me_too", label: "Más me-too" },
  { id: "answered_first", label: "Respondidas" },
  { id: "unresolved_first", label: "Pendientes" },
];

const STATUS_LABELS: Record<MaterialQuestionStatus, string> = {
  open: "Pendiente",
  answered: "Respondida",
  resolved: "Resuelta",
  hidden: "Oculta",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function OwnerMaterialQuestionsManager({
  questions,
  pagination,
  filters,
}: {
  questions: OwnerMaterialQuestionItem[];
  pagination?: MaterialQuestionsPagination;
  filters?: {
    query: string;
    status: OwnerStatusFilter;
    target: OwnerTargetFilter;
    sort: OwnerSortOption;
  };
}) {
  const activeFilters = filters ?? {
    query: "",
    status: "all" as OwnerStatusFilter,
    target: "all" as OwnerTargetFilter,
    sort: "default" as OwnerSortOption,
  };
  const [items, setItems] = useState(questions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(activeFilters.query);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    setItems(questions);
  }, [questions]);

  useEffect(() => {
    setSearchInput(activeFilters.query);
  }, [activeFilters.query]);

  const buildHref = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.set("inventario", "consultas");
    return `${pathname}?${next.toString()}#consultas-list`;
  };

  const navigateWith = (updates: Record<string, string | null>) => {
    // Filtros server-side: cualquier cambio resetea consultasPage.
    router.push(buildHref({ ...updates, consultasPage: null }), { scroll: false });
  };

  useEffect(() => {
    const trimmed = searchInput.trim().slice(0, 200);
    if (trimmed === activeFilters.query) return;
    const timer = window.setTimeout(() => {
      navigateWith({ consultasQ: trimmed.length > 0 ? trimmed : null });
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, activeFilters.query]);

  const loadMoreHref = useMemo(() => {
    if (!pagination?.hasMore) return null;
    return buildHref({ consultasPage: String(pagination.page + 1) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination, pathname, searchParams]);

  const filteredQuestions = items;

  const pendingCount = items.filter((question) => question.status === "open").length;

  async function updateStatus(questionId: string, status: MaterialQuestionStatus) {
    setPendingId(questionId);
    setActionError(null);
    try {
      const response = await fetch(`/api/material-questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No pudimos cambiar el estado.");
      }

      setItems((current) =>
        current.map((question) =>
          question.id === questionId ? { ...question, status } : question
        )
      );
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "No pudimos cambiar el estado."
      );
    } finally {
      setPendingId(null);
    }
  }

  async function deleteQuestion(questionId: string) {
    if (!window.confirm("¿Borrar esta consulta y todo su hilo?")) return;

    setPendingId(questionId);
    setActionError(null);
    try {
      const response = await fetch(`/api/material-questions/${questionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No pudimos borrar la consulta.");
      }

      setItems((current) => current.filter((question) => question.id !== questionId));
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "No pudimos borrar la consulta."
      );
    } finally {
      setPendingId(null);
    }
  }

  function refreshAfterAnswer(questionId: string) {
    setItems((current) =>
      current.map((question) =>
        question.id === questionId && question.status === "open"
          ? {
              ...question,
              status: "answered",
              counts: { ...question.counts, answers: question.counts.answers + 1 },
            }
          : question
      )
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Consultas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {pendingCount} pendiente{pendingCount === 1 ? "" : "s"} por responder en esta vista.
            </p>
          </div>
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Buscar en consultas</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar en consultas..."
              maxLength={200}
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-accent-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20 dark:border-white/10 dark:bg-white/[0.03] dark:focus-visible:border-accent-300/40"
            />
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Estado
            </span>
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  navigateWith({ consultasStatus: item.id === "all" ? null : item.id })
                }
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  activeFilters.status === item.id
                    ? "border-accent-300 bg-accent-50 text-accent-700 dark:border-accent-300/30 dark:bg-accent-300/10 dark:text-accent-100"
                    : "border-gray-200 text-muted-foreground hover:border-accent-200 hover:text-accent-700 dark:border-white/10"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Material
            </span>
            {TARGET_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  navigateWith({ consultasTarget: item.id === "all" ? null : item.id })
                }
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  activeFilters.target === item.id
                    ? "border-accent-300 bg-accent-50 text-accent-700 dark:border-accent-300/30 dark:bg-accent-300/10 dark:text-accent-100"
                    : "border-gray-200 text-muted-foreground hover:border-accent-200 hover:text-accent-700 dark:border-white/10"
                }`}
              >
                {item.id === "resume" && <FileText className="h-3 w-3" />}
                {item.id === "course" && <GraduationCap className="h-3 w-3" />}
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Orden
            </span>
            {SORT_OPTIONS_OWNER.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  navigateWith({ consultasSort: item.id === "default" ? null : item.id })
                }
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  activeFilters.sort === item.id
                    ? "border-accent-300 bg-accent-50 text-accent-700 dark:border-accent-300/30 dark:bg-accent-300/10 dark:text-accent-100"
                    : "border-gray-200 text-muted-foreground hover:border-accent-200 hover:text-accent-700 dark:border-white/10"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredQuestions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center dark:border-white/10 dark:bg-white/[0.03]">
          <MessageCircleReply className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-bold text-foreground">
            {activeFilters.query.length > 0 ||
            activeFilters.status !== "all" ||
            activeFilters.target !== "all"
              ? "No hay consultas que coincidan con la búsqueda."
              : "Todavía no hay consultas."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {actionError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
              {actionError}
            </div>
          )}

          {filteredQuestions.map((question) => (
            <article
              key={question.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-700 dark:bg-white/[0.06] dark:text-sand-300">
                      {question.targetType === "resume" ? (
                        <FileText className="h-3.5 w-3.5" />
                      ) : (
                        <GraduationCap className="h-3.5 w-3.5" />
                      )}
                      {question.targetType === "resume" ? "Apunte" : "Curso"}
                    </span>
                    <span className="rounded-md bg-accent-50 px-2 py-1 text-[11px] font-bold text-accent-700 dark:bg-accent-300/10 dark:text-accent-100">
                      {STATUS_LABELS[question.status]}
                    </span>
                    <QuestionContextBadge
                      page={question.anchorPage}
                      seconds={question.anchorSeconds}
                      compact
                    />
                    <span className="text-xs text-muted-foreground">
                      {formatDate(question.createdAt)}
                    </span>
                  </div>

                  <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {question.material.title}
                    {question.module
                      ? ` · Módulo ${question.module.position}: ${question.module.title}`
                      : ""}
                  </p>
                  <h3 className="mt-1 text-lg font-bold leading-6 text-foreground">
                    {question.title}
                  </h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                    {question.body}
                  </p>
                </div>

                <div className="w-full shrink-0 rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.04] lg:w-72">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent-100 text-sm font-bold text-accent-700 dark:bg-accent-300/10 dark:text-accent-100">
                      {question.student.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={question.student.avatarUrl}
                          alt={question.student.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials(question.student.displayName) || <UserRound className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {question.student.displayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Alumno real
                      </p>
                      {question.isAnonymousToBuyers && (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground ring-1 ring-gray-200 dark:bg-white/[0.06] dark:ring-white/10">
                          <EyeOff className="h-3 w-3" />
                          Anónima para compradores
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-white p-2 dark:bg-[#071713]">
                      <p className="font-bold text-foreground">{question.counts.meToo}</p>
                      <p className="text-muted-foreground">Dudas</p>
                    </div>
                    <div className="rounded-xl bg-white p-2 dark:bg-[#071713]">
                      <p className="font-bold text-foreground">{question.counts.answers}</p>
                      <p className="text-muted-foreground">Resp.</p>
                    </div>
                    <div className="rounded-xl bg-white p-2 dark:bg-[#071713]">
                      <p className="font-bold text-foreground">{question.counts.helpful}</p>
                      <p className="text-muted-foreground">Útiles</p>
                    </div>
                  </div>

                  {typeof question.anchorSeconds === "number" && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Contexto: {formatSeconds(question.anchorSeconds)}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-white/10">
                {question.status === "resolved" && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-green-200 px-3 py-2 text-xs font-bold text-green-700 dark:border-green-300/25 dark:text-green-100">
                    <CheckCircle2 className="h-4 w-4" />
                    Resuelta por el comprador
                  </span>
                )}
                {question.status !== "hidden" ? (
                  <button
                    type="button"
                    onClick={() => updateStatus(question.id, "hidden")}
                    disabled={pendingId === question.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-red-200 hover:text-red-700 disabled:opacity-60 dark:border-white/10"
                  >
                    <EyeOff className="h-4 w-4" />
                    Ocultar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateStatus(question.id, "open")}
                    disabled={pendingId === question.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-accent-200 px-3 py-2 text-xs font-bold text-accent-700 transition-colors hover:bg-accent-50 disabled:opacity-60 dark:border-accent-300/25 dark:text-accent-100"
                  >
                    <ArchiveRestore className="h-4 w-4" />
                    Reabrir
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-muted-foreground dark:border-white/10">
                  <ThumbsUp className="h-4 w-4" />
                  {question.counts.helpful} votos útiles
                </span>
                <button
                  type="button"
                  onClick={() => deleteQuestion(question.id)}
                  disabled={pendingId === question.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-300/25 dark:text-red-100 dark:hover:bg-red-400/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Borrar
                </button>
              </div>

              {question.status !== "hidden" && (
                <AnswerComposer
                  questionId={question.id}
                  onAnswered={() => refreshAfterAnswer(question.id)}
                />
              )}
            </article>
          ))}

          {loadMoreHref && (
            <div id="consultas-list" className="pt-2">
              <Link
                href={loadMoreHref}
                scroll={false}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-foreground transition-colors hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-300/25 dark:hover:bg-accent-300/10 dark:hover:text-accent-100"
              >
                Ver más consultas (
                {(pagination?.total ?? 0) - items.length} restantes)
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
