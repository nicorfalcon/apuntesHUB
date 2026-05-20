"use client";

import { FormEvent, useState } from "react";
import { SendHorizontal } from "lucide-react";

export function AnswerComposer({
  questionId,
  onAnswered,
}: {
  questionId: string;
  onAnswered: () => void;
}) {
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/material-questions/${questionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No pudimos publicar la respuesta.");
      }

      setBody("");
      onAnswered();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No pudimos publicar la respuesta."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-2">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={4000}
        rows={3}
        placeholder="Responder oficialmente..."
        className="min-h-[92px] w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-gray-400 focus:border-accent-500 dark:border-white/10 dark:bg-white/[0.04]"
      />
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting || body.trim().length === 0}
        className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-300 dark:text-[#071713]"
      >
        <SendHorizontal className="h-4 w-4" />
        {isSubmitting ? "Publicando..." : "Responder"}
      </button>
    </form>
  );
}
