"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";

interface MessageReplyFormProps {
  bookingId: string;
}

export function MessageReplyForm({ bookingId }: MessageReplyFormProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Escribí un mensaje antes de enviarlo.");
      return;
    }

    setLoading(true);
    setError(null);

    const response = await fetch("/api/tutors/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, body: trimmed }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(data.error ?? "No pudimos enviar el mensaje.");
      setLoading(false);
      return;
    }

    setBody("");
    setLoading(false);
    toast.success("Mensaje enviado.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#0f1e1a]">
      <label htmlFor="reply" className="sr-only">
        Escribir mensaje
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id="reply"
          name="reply"
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            if (error) setError(null);
          }}
          rows={2}
          maxLength={1000}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "reply-error" : undefined}
          placeholder="Escribí una respuesta…"
          className="min-h-12 flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-gray-400 focus-visible:border-accent-400 focus-visible:ring-2 focus-visible:ring-accent-200/40 dark:border-white/15 dark:bg-white/5 dark:placeholder:text-sand-300/45 dark:focus-visible:border-accent-300 dark:focus-visible:ring-accent-300/15"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-600 text-white transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-accent-300 dark:text-[#071713]"
          aria-label="Enviar mensaje"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p id="reply-error" aria-live="polite" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </p>
      )}
    </form>
  );
}
