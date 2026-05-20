"use client";

import { FormEvent, useState } from "react";
import { SendHorizontal } from "lucide-react";
import type { MaterialFollowUpRole } from "./types";

const LABELS: Record<MaterialFollowUpRole, { label: string; placeholder: string; cta: string }> = {
  buyer: {
    label: "Pedir aclaración",
    placeholder: "Pediste una aclaración corta sobre la respuesta del autor.",
    cta: "Enviar aclaración",
  },
  owner: {
    label: "Comentario adicional",
    placeholder: "Sumá un comentario corto para el comprador original.",
    cta: "Enviar comentario",
  },
};

export function FollowupComposer({
  questionId,
  role,
  onSent,
}: {
  questionId: string;
  role: MaterialFollowUpRole;
  onSent: () => void;
}) {
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaId = `material-followup-${questionId}`;
  const copy = LABELS[role];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/material-questions/${questionId}/followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No pudimos enviar el mensaje.");
      }

      setBody("");
      onSent();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "No pudimos enviar el mensaje."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/[0.035]"
    >
      <label
        htmlFor={textareaId}
        className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
      >
        {copy.label}
      </label>
      <textarea
        id={textareaId}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={2000}
        rows={2}
        placeholder={copy.placeholder}
        className="mt-2 min-h-[64px] w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-gray-400 focus:border-accent-400 dark:border-white/10 dark:bg-white/[0.04]"
      />
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || body.trim().length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-300 dark:text-[#071713]"
        >
          <SendHorizontal className="h-4 w-4" />
          {isSubmitting ? "Enviando..." : copy.cta}
        </button>
      </div>
    </form>
  );
}
