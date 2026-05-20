"use client";

import { useState } from "react";
import {
  CheckCircle2,
  CircleHelp,
  EyeOff,
  MessageCircle,
  Play,
  ThumbsUp,
} from "lucide-react";
import { AnswerComposer } from "./answer-composer";
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
    "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-300/10 dark:text-blue-100 dark:ring-blue-300/20",
  resolved:
    "bg-green-50 text-green-700 ring-green-100 dark:bg-green-300/10 dark:text-green-100 dark:ring-green-300/20",
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
}: {
  question: MaterialQuestionDto;
  onChanged: () => void;
  onJumpToSeconds?: (seconds: number) => void;
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
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold ring-1 ${STATUS_CLASSES[question.status]}`}
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

      <h3 className="mt-3 text-sm font-bold leading-5 text-foreground">
        {question.title}
      </h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
        {question.body}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{question.author.displayName}</span>
        {question.author.isAnonymous && (
          <span className="inline-flex items-center gap-1">
            <EyeOff className="h-3.5 w-3.5" />
            Anónimo
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleMeToo}
          disabled={pendingAction === "me-too" || question.status === "hidden"}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            question.viewer.hasMeToo
              ? "border-accent-300 bg-accent-50 text-accent-700 dark:border-accent-300/30 dark:bg-accent-300/10 dark:text-accent-100"
              : "border-gray-200 text-muted-foreground hover:border-accent-200 hover:text-accent-700 dark:border-white/10 dark:hover:border-accent-300/25 dark:hover:text-accent-100"
          }`}
        >
          <CircleHelp className="h-4 w-4" />
          También tengo esta duda · {question.counts.meToo}
        </button>

        {typeof question.anchorSeconds === "number" && onJumpToSeconds && (
          <button
            type="button"
            onClick={() => onJumpToSeconds(question.anchorSeconds!)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-accent-200 hover:text-accent-700 dark:border-white/10"
          >
            <Play className="h-4 w-4" />
            Ir al minuto
          </button>
        )}

        {question.viewer.isOwner && question.status !== "resolved" && question.status !== "hidden" && (
          <button
            type="button"
            onClick={markResolved}
            disabled={pendingAction === "resolved"}
            className="inline-flex items-center gap-1.5 rounded-xl border border-green-200 px-3 py-2 text-xs font-bold text-green-700 transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-300/25 dark:text-green-100"
          >
            <CheckCircle2 className="h-4 w-4" />
            Marcar resuelta
          </button>
        )}
      </div>

      {question.answers.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4 dark:border-white/10">
          {question.answers.map((answer) => (
            <div
              key={answer.id}
              className="rounded-xl bg-gray-50 p-3 dark:bg-white/[0.04]"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-2 py-1 font-bold text-white dark:bg-accent-300 dark:text-[#071713]">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Respuesta oficial
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
                className={`mt-3 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  answer.viewerHasHelpful
                    ? "border-accent-300 bg-accent-50 text-accent-700 dark:border-accent-300/30 dark:bg-accent-300/10 dark:text-accent-100"
                    : "border-gray-200 text-muted-foreground hover:border-accent-200 hover:text-accent-700 dark:border-white/10"
                }`}
              >
                <ThumbsUp className="h-4 w-4" />
                Me sirvió · {answer.helpfulCount}
              </button>
            </div>
          ))}
        </div>
      )}

      {question.viewer.canAnswer && (
        <AnswerComposer questionId={question.id} onAnswered={onChanged} />
      )}
    </article>
  );
}
