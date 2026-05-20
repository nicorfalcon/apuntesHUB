"use client";

import { useState } from "react";
import {
  CheckCircle2,
  CircleHelp,
  EyeOff,
  Lock,
  MessageCircle,
  Play,
  ThumbsUp,
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

  async function toggleMeToo() {
    setPendingAction("me-too");
    try {
      await fetch(`/api/material-questions/${question.id}/me-too`, {
        method: question.viewer.hasMeToo ? "DELETE" : "POST",
      });
      onChanged();
    } finally {
      setPendingAction(null);
    }
  }

  async function toggleHelpful(answerId: string, hasVote: boolean) {
    setPendingAction(answerId);
    try {
      await fetch(`/api/material-answers/${answerId}/helpful`, {
        method: hasVote ? "DELETE" : "POST",
      });
      onChanged();
    } finally {
      setPendingAction(null);
    }
  }

  async function markResolved() {
    setPendingAction("resolved");
    try {
      await fetch(`/api/material-questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      onChanged();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <article
      className={`rounded-[16px] border border-gray-200 bg-white shadow-[0_10px_28px_-26px_rgba(12,25,20,0.45)] dark:border-white/10 dark:bg-white/[0.03] ${
        compact ? "p-3" : "p-4"
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

      <h3 className="mt-2.5 text-sm font-bold leading-5 text-foreground">
        {question.title}
      </h3>
      <p className={`mt-1.5 whitespace-pre-line text-sm text-muted-foreground ${
        compact ? "leading-5" : "leading-6"
      }`}>
        {question.body}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{question.author.displayName}</span>
        {question.author.isAnonymous && (
          <span className="inline-flex items-center gap-1 text-[11px]">
            <EyeOff className="h-3.5 w-3.5" />
            Anónimo
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleMeToo}
          disabled={pendingAction === "me-too" || question.status === "hidden"}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            question.viewer.hasMeToo
              ? "bg-accent-50 text-accent-700 ring-1 ring-accent-100 dark:bg-accent-300/10 dark:text-accent-100 dark:ring-accent-300/20"
              : "text-muted-foreground hover:bg-gray-50 hover:text-accent-700 dark:hover:bg-white/[0.04] dark:hover:text-accent-100"
          }`}
        >
          <CircleHelp className="h-3.5 w-3.5" />
          También tengo esta duda · {question.counts.meToo}
        </button>

        {typeof question.anchorSeconds === "number" && onJumpToSeconds && (
          <button
            type="button"
            onClick={() => onJumpToSeconds(question.anchorSeconds!)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-gray-50 hover:text-accent-700 dark:hover:bg-white/[0.04]"
          >
            <Play className="h-3.5 w-3.5" />
            Ir al minuto
          </button>
        )}

        {question.viewer.isOwner && question.status !== "resolved" && question.status !== "hidden" && (
          <button
            type="button"
            onClick={markResolved}
            disabled={pendingAction === "resolved"}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-100 dark:hover:bg-emerald-300/10"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Marcar resuelta
          </button>
        )}
      </div>

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
              <button
                type="button"
                onClick={() => toggleHelpful(answer.id, answer.viewerHasHelpful)}
                disabled={pendingAction === answer.id || question.status === "hidden"}
                className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  answer.viewerHasHelpful
                    ? "bg-white text-accent-700 ring-1 ring-accent-100 dark:bg-white/[0.06] dark:text-accent-100 dark:ring-accent-300/15"
                    : "text-muted-foreground hover:bg-white/70 hover:text-accent-700 dark:hover:bg-white/[0.06]"
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                Me sirvió · {answer.helpfulCount}
              </button>
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
      ) : question.viewer.isOwner && question.status === "resolved" ? (
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
