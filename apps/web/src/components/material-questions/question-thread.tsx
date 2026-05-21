"use client";

import { FormEvent, useState } from "react";
import {
  CheckCircle2,
  CircleHelp,
  Pencil,
  EyeOff,
  Lock,
  MessageCircle,
  Play,
  Save,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { AnswerComposer } from "./answer-composer";
import { FollowupComposer } from "./followup-composer";
import { QuestionContextBadge } from "./question-context-badge";
import type { MaterialQuestionDto, MaterialQuestionStatus } from "./types";

const STATUS_LABELS: Record<MaterialQuestionStatus, string> = {
  open: "Pendiente",
  answered: "Respondida",
  resolved: "Resuelta",
  hidden: "Oculta",
};

const STATUS_CLASSES: Record<MaterialQuestionStatus, string> = {
  open: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-300/10 dark:text-amber-100 dark:ring-amber-300/20",
  answered:
    "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-300/10 dark:text-sky-100 dark:ring-sky-300/20",
  resolved:
    "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-300/10 dark:text-emerald-100 dark:ring-emerald-300/20",
  hidden:
    "bg-gray-100 text-gray-600 ring-gray-200 dark:bg-white/[0.06] dark:text-sand-300 dark:ring-white/10",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

export function QuestionThread({
  question,
  onChanged,
  onJumpToSeconds,
  compact = false,
}: {
  question: MaterialQuestionDto;
  onChanged: () => void;
  onJumpToSeconds?: (seconds: number) => void;
  compact?: boolean;
}) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(question.title);
  const [editBody, setEditBody] = useState(question.body);
  const [editAnonymous, setEditAnonymous] = useState(question.isAnonymousToBuyers);
  const canReact = question.viewer.canReact && question.status !== "hidden";
  const canSubmitEdit =
    editTitle.trim().length >= 8 &&
    editTitle.trim().length <= 140 &&
    editBody.trim().length >= 10 &&
    editBody.trim().length <= 2000 &&
    pendingAction !== "edit";

  async function requireOk(response: Response, fallback: string) {
    if (response.ok) return;
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? fallback);
  }

  async function toggleMeToo() {
    if (!canReact) return;
    setPendingAction("me-too");
    setActionError(null);
    try {
      const response = await fetch(`/api/material-questions/${question.id}/me-too`, {
        method: question.viewer.hasMeToo ? "DELETE" : "POST",
      });
      await requireOk(response, "No pudimos guardar esta marca.");
      onChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No pudimos guardar esta marca.");
    } finally {
      setPendingAction(null);
    }
  }

  async function toggleHelpful(answerId: string, hasVote: boolean) {
    if (!canReact) return;
    setPendingAction(answerId);
    setActionError(null);
    try {
      const response = await fetch(`/api/material-answers/${answerId}/helpful`, {
        method: hasVote ? "DELETE" : "POST",
      });
      await requireOk(response, "No pudimos guardar tu voto.");
      onChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No pudimos guardar tu voto.");
    } finally {
      setPendingAction(null);
    }
  }

  async function markResolved() {
    setPendingAction("resolved");
    setActionError(null);
    try {
      const response = await fetch(`/api/material-questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      await requireOk(response, "No pudimos marcar la consulta como resuelta.");
      onChanged();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "No pudimos marcar la consulta como resuelta."
      );
    } finally {
      setPendingAction(null);
    }
  }

  function startEditing() {
    setEditTitle(question.title);
    setEditBody(question.body);
    setEditAnonymous(question.isAnonymousToBuyers);
    setActionError(null);
    setIsEditing(true);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitEdit) return;

    setPendingAction("edit");
    setActionError(null);
    try {
      const response = await fetch(`/api/material-questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          body: editBody.trim(),
          isAnonymousToBuyers: editAnonymous,
        }),
      });
      await requireOk(response, "No pudimos editar la consulta.");
      setIsEditing(false);
      onChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No pudimos editar la consulta.");
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteQuestion() {
    const message = question.viewer.canModerate
      ? "¿Borrar esta consulta y todas sus respuestas?"
      : "¿Borrar tu consulta? Esta acción no se puede deshacer.";
    if (!window.confirm(message)) return;

    setPendingAction("delete");
    setActionError(null);
    try {
      const response = await fetch(`/api/material-questions/${question.id}`, {
        method: "DELETE",
      });
      await requireOk(response, "No pudimos borrar la consulta.");
      onChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No pudimos borrar la consulta.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <article
      className={`rounded-[16px] border border-gray-200 bg-white shadow-[0_10px_28px_-26px_rgba(12,25,20,0.45)] dark:border-white/10 dark:bg-white/[0.03] ${
        compact ? "p-3" : "p-3 sm:p-4"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-bold ring-1 ${STATUS_CLASSES[question.status]}`}
        >
          {STATUS_LABELS[question.status]}
        </span>
        <QuestionContextBadge
          page={question.anchorPage}
          seconds={question.anchorSeconds}
          compact
        />
        <span className="text-[11px] font-medium text-muted-foreground">
          {formatDate(question.createdAt)}
        </span>
      </div>

      {isEditing ? (
        <form onSubmit={saveEdit} className="mt-3 space-y-2.5">
          <input
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            maxLength={140}
            className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-foreground outline-none transition-colors placeholder:text-gray-400 focus:border-accent-400 dark:border-white/10 dark:bg-white/[0.04]"
          />
          <textarea
            value={editBody}
            onChange={(event) => setEditBody(event.target.value)}
            maxLength={2000}
            rows={4}
            className="min-h-[104px] w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-gray-400 focus:border-accent-400 dark:border-white/10 dark:bg-white/[0.04]"
          />
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <input
              type="checkbox"
              checked={editAnonymous}
              onChange={(event) => setEditAnonymous(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500"
            />
            Anónima para otros compradores
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-gray-50 hover:text-foreground dark:hover:bg-white/[0.04] sm:w-auto"
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmitEdit}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent-600 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-300 dark:text-[#071713] sm:w-auto"
            >
              <Save className="h-3.5 w-3.5" />
              Guardar
            </button>
          </div>
        </form>
      ) : (
        <>
          <h3 className="mt-2.5 text-sm font-bold leading-5 text-foreground">
            {question.title}
          </h3>
          <p className={`mt-1.5 whitespace-pre-line text-sm text-muted-foreground ${
            compact ? "leading-5" : "leading-6"
          }`}>
            {question.body}
          </p>
        </>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{question.author.displayName}</span>
        {question.author.isAnonymous && (
          <span className="inline-flex items-center gap-1 text-[11px]">
            <EyeOff className="h-3.5 w-3.5" />
            Anónimo
          </span>
        )}
        {question.isAnonymousToBuyers && !question.author.isAnonymous && (
          <span className="inline-flex items-center gap-1 text-[11px]">
            <EyeOff className="h-3.5 w-3.5" />
            Anónima para compradores
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canReact ? (
          <button
            type="button"
            onClick={toggleMeToo}
            disabled={pendingAction === "me-too"}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              question.viewer.hasMeToo
                ? "bg-accent-50 text-accent-700 ring-1 ring-accent-100 dark:bg-accent-300/10 dark:text-accent-100 dark:ring-accent-300/20"
                : "text-muted-foreground hover:bg-gray-50 hover:text-accent-700 dark:hover:bg-white/[0.04] dark:hover:text-accent-100"
            }`}
          >
            <CircleHelp className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              También tengo esta duda · {question.counts.meToo}
            </span>
          </button>
        ) : (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted-foreground">
            <CircleHelp className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{question.counts.meToo} con esta duda</span>
          </span>
        )}

        {typeof question.anchorSeconds === "number" && onJumpToSeconds && (
          <button
            type="button"
            onClick={() => onJumpToSeconds(question.anchorSeconds!)}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-gray-50 hover:text-accent-700 dark:hover:bg-white/[0.04]"
          >
            <Play className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Ir al minuto</span>
          </button>
        )}

        {question.viewer.canEdit && !isEditing && (
          <button
            type="button"
            onClick={startEditing}
            disabled={pendingAction !== null}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-gray-50 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/[0.04] dark:hover:text-accent-100"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        )}

        {question.viewer.isQuestionAuthor && question.status !== "resolved" && question.status !== "hidden" && (
          <button
            type="button"
            onClick={markResolved}
            disabled={pendingAction === "resolved"}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-100 dark:hover:bg-emerald-300/10"
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Marcar resuelta</span>
          </button>
        )}

        {question.viewer.canDelete && (
          <button
            type="button"
            onClick={deleteQuestion}
            disabled={pendingAction === "delete"}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-100 dark:hover:bg-red-400/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Borrar
          </button>
        )}
      </div>

      {actionError && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
          {actionError}
        </div>
      )}

      {question.answers.length > 0 && (
        <div className="mt-3 space-y-2.5 border-t border-gray-100 pt-3 dark:border-white/10">
          {question.answers.map((answer) => (
            <div
              key={answer.id}
              className="rounded-xl border border-accent-100/80 bg-accent-50/35 p-3 dark:border-accent-300/15 dark:bg-accent-300/[0.06]"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 font-bold text-accent-700 ring-1 ring-accent-100 dark:bg-white/[0.06] dark:text-accent-100 dark:ring-accent-300/15">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Respuesta del autor
                </span>
                <span className="font-semibold text-foreground">
                  {answer.author.displayName}
                </span>
                <span className="text-muted-foreground">{formatDate(answer.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">
                {answer.body}
              </p>
              {canReact ? (
                <button
                  type="button"
                  onClick={() => toggleHelpful(answer.id, answer.viewerHasHelpful)}
                  disabled={pendingAction === answer.id}
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    answer.viewerHasHelpful
                      ? "bg-white text-accent-700 ring-1 ring-accent-100 dark:bg-white/[0.06] dark:text-accent-100 dark:ring-accent-300/15"
                      : "text-muted-foreground hover:bg-white/70 hover:text-accent-700 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Me sirvió · {answer.helpfulCount}
                </button>
              ) : (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted-foreground">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {answer.helpfulCount} voto{answer.helpfulCount === 1 ? "" : "s"} útil
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {question.followups.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-white/10">
          {question.followups.map((followup) => {
            const isOwnerFollowup = followup.role === "owner";
            return (
              <div
                key={followup.id}
                className={`rounded-xl border p-3 ${
                  isOwnerFollowup
                    ? "border-accent-100/60 bg-accent-50/20 dark:border-accent-300/10 dark:bg-accent-300/[0.04]"
                    : "border-gray-100 bg-gray-50/60 dark:border-white/10 dark:bg-white/[0.03]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span
                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-bold ring-1 ${
                      isOwnerFollowup
                        ? "bg-white text-accent-700 ring-accent-100 dark:bg-white/[0.06] dark:text-accent-100 dark:ring-accent-300/15"
                        : "bg-white text-gray-700 ring-gray-200 dark:bg-white/[0.06] dark:text-sand-100 dark:ring-white/10"
                    }`}
                  >
                    {isOwnerFollowup ? "Autor" : "Comprador"}
                  </span>
                  <span className="font-semibold text-foreground">
                    {followup.author.displayName}
                  </span>
                  {followup.author.isAnonymous && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <EyeOff className="h-3 w-3" />
                      Anónimo
                    </span>
                  )}
                  {question.isAnonymousToBuyers &&
                    !followup.author.isAnonymous &&
                    followup.role === "buyer" && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <EyeOff className="h-3 w-3" />
                        Anónima para compradores
                      </span>
                    )}
                  <span className="text-muted-foreground">{formatDate(followup.createdAt)}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-5 text-foreground">
                  {followup.body}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {question.status === "hidden" ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
          <Lock className="h-3.5 w-3.5" />
          Este hilo está cerrado.
        </div>
      ) : question.viewer.isQuestionAuthor && question.status === "resolved" ? (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
          Marcaste esta consulta como resuelta. Si necesitás otra cosa, abrí una consulta nueva.
        </div>
      ) : question.viewer.canFollowUp && question.viewer.followUpRole ? (
        <FollowupComposer
          questionId={question.id}
          role={question.viewer.followUpRole}
          onSent={onChanged}
        />
      ) : null}

      {question.viewer.canAnswer && (
        <AnswerComposer questionId={question.id} onAnswered={onChanged} />
      )}
    </article>
  );
}
