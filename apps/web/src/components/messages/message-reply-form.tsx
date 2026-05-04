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
    if (!trimmed) return;

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
    <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4 dark:border-white/10">
      <label htmlFor="reply" className="sr-only">
        Escribir mensaje
      </label>
      <div className="flex gap-2">
        <textarea
          id="reply"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Escribí una respuesta..."
          className="min-h-12 flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-200/40 dark:border-white/15 dark:bg-white/5 dark:placeholder:text-sand-300/45 dark:focus:border-accent-300 dark:focus:ring-accent-300/15"
        />
        <button
          type="submit"
          disabled={loading || !body.trim()}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-600 text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-accent-300 dark:text-[#071713]"
          aria-label="Enviar mensaje"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </p>
      )}
    </form>
  );
}

