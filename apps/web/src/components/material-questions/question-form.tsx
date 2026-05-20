"use client";

import { FormEvent, useState } from "react";
import { SendHorizontal } from "lucide-react";
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
      className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
    >
      <div className="space-y-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={140}
          placeholder="Título corto de tu duda"
          className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-foreground outline-none transition-colors placeholder:font-medium placeholder:text-gray-400 focus:border-accent-500 dark:border-white/10 dark:bg-white/[0.04]"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Contá qué parte no te cierra. Evitá pegar páginas completas del material."
          className="min-h-[120px] w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-gray-400 focus:border-accent-500 dark:border-white/10 dark:bg-white/[0.04]"
        />
      </div>

      <label className="mt-3 flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-muted-foreground dark:bg-white/[0.04]">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(event) => setAnonymous(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500"
        />
        <span>
          Publicar anónimo para otros compradores. El dueño del material podrá ver tu identidad.
        </span>
      </label>

      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-300 dark:text-[#071713]"
        >
          <SendHorizontal className="h-4 w-4" />
          {isSubmitting ? "Enviando..." : "Publicar consulta"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-gray-300 hover:text-foreground dark:border-white/10"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
