"use client";

import { FormEvent, useId, useState } from "react";
import { SendHorizontal, ShieldCheck } from "lucide-react";
import type { MaterialTargetType } from "./types";

export function QuestionForm({
  targetType,
  resumeId,
  courseId,
  moduleId,
  anchorPage,
  anchorSeconds,
  onCreated,
  onCancel,
}: {
  targetType: MaterialTargetType;
  resumeId?: string;
  courseId?: string;
  moduleId?: string | null;
  anchorPage?: number | null;
  anchorSeconds?: number | null;
  onCreated: () => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formId = useId();
  const titleId = `${formId}-title`;
  const bodyId = `${formId}-body`;
  const canSubmit =
    title.trim().length >= 8 &&
    title.trim().length <= 140 &&
    body.trim().length >= 10 &&
    body.trim().length <= 2000 &&
    !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (trimmedTitle.length < 8 || trimmedTitle.length > 140) {
      setError("El título debe tener entre 8 y 140 caracteres.");
      return;
    }

    if (trimmedBody.length < 10 || trimmedBody.length > 2000) {
      setError("El detalle debe tener entre 10 y 2000 caracteres.");
      return;
    }

    const payload =
      targetType === "resume"
        ? {
            targetType,
            resumeId,
            anchorPage,
            title: trimmedTitle,
            body: trimmedBody,
            isAnonymousToBuyers: anonymous,
          }
        : {
            targetType,
            courseId,
            moduleId,
            anchorSeconds,
            title: trimmedTitle,
            body: trimmedBody,
            isAnonymousToBuyers: anonymous,
          };

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/material-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No pudimos crear la consulta.");
      }

      setTitle("");
      setBody("");
      setAnonymous(false);
      onCreated();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "No pudimos crear la consulta."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[18px] border border-gray-200 bg-white p-3 shadow-[0_12px_32px_-28px_rgba(12,25,20,0.45)] dark:border-white/10 dark:bg-white/[0.035] sm:p-3.5"
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor={titleId}
            className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
          >
            Título
          </label>
          <input
            id={titleId}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={140}
            placeholder="Qué parte te genera duda"
            className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50/70 px-3 text-sm font-semibold text-foreground outline-none transition-colors placeholder:font-medium placeholder:text-gray-400 focus:border-accent-400 focus:bg-white dark:border-white/10 dark:bg-white/[0.04]"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={bodyId}
            className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
          >
            Detalle
          </label>
          <textarea
            id={bodyId}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Contá el problema con tus palabras."
            className="min-h-[104px] w-full resize-y rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-gray-400 focus:border-accent-400 focus:bg-white dark:border-white/10 dark:bg-white/[0.04]"
          />
          <p className="text-[11px] leading-4 text-muted-foreground">
            Evitá copiar páginas completas del material.
          </p>
        </div>
      </div>

      <label className="mt-3 flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5 text-xs leading-5 text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(event) => setAnonymous(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500"
        />
        <span className="min-w-0">
          <span className="block font-semibold text-foreground">
            Publicar anónimamente para otros compradores
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[11px] leading-4 text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            El dueño del material seguirá viendo tu identidad.
          </span>
        </span>
      </label>

      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-gray-50 hover:text-foreground dark:hover:bg-white/[0.04] sm:w-auto"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-300 dark:text-[#071713] sm:w-auto"
        >
          <SendHorizontal className="h-4 w-4" />
          {isSubmitting ? "Enviando..." : "Publicar consulta"}
        </button>
      </div>
    </form>
  );
}
