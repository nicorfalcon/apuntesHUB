"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import type { AiConversationSummary } from "@/lib/ai/conversations";

function formatConversationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AiConversationList({
  resumeId,
  activeConversationId,
  refreshSignal = 0,
  onSelectConversation,
  onNewConversation,
}: {
  resumeId: string;
  activeConversationId: string | null;
  refreshSignal?: number;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
}) {
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/conversations?resumeId=${encodeURIComponent(resumeId)}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as
        | { conversations?: AiConversationSummary[]; error?: string }
        | null;
      if (!res.ok) throw new Error(data?.error ?? "No pudimos cargar el historial.");
      setConversations(data?.conversations ?? []);
    } catch (loadError) {
      setConversations([]);
      setError(loadError instanceof Error ? loadError.message : "No pudimos cargar el historial.");
    } finally {
      setLoading(false);
    }
  }, [resumeId]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations, refreshSignal]);

  async function archiveConversation(conversationId: string) {
    const previous = conversations;
    setConversations((current) => current.filter((item) => item.id !== conversationId));
    try {
      const res = await fetch(`/api/ai/conversations/${conversationId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("No pudimos archivar la conversación.");
    } catch {
      setConversations(previous);
    }
  }

  return (
    <section className="space-y-3 px-2 pb-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight text-foreground">Historial IA</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Retomá explicaciones y prácticas de este apunte.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewConversation}
          aria-label="Nueva conversación"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-600 text-white transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 dark:bg-accent-300 dark:text-[#071713]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[70, 88, 62].map((width, index) => (
            <div
              key={index}
              className="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-white/[0.06]"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </p>
      ) : conversations.length === 0 ? (
        <button
          type="button"
          onClick={onNewConversation}
          className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center transition-colors hover:border-accent-200 hover:bg-accent-50/70 dark:border-white/10 dark:hover:border-accent-300/25 dark:hover:bg-accent-300/10"
        >
          <MessageSquare className="mb-2 h-5 w-5 text-accent-600 dark:text-accent-200" />
          <span className="text-sm font-semibold text-foreground">Empezar historial</span>
          <span className="mt-1 text-xs leading-5 text-muted-foreground">
            Tu próxima charla con IA va a quedar guardada acá.
          </span>
        </button>
      ) : (
        <div className="space-y-2">
          {conversations.map((conversation) => {
            const active = conversation.id === activeConversationId;
            return (
              <div
                key={conversation.id}
                className={`group flex items-start gap-2 rounded-xl border p-2 transition-colors ${
                  active
                    ? "border-accent-200 bg-accent-50 text-accent-900 dark:border-accent-300/30 dark:bg-accent-300/10 dark:text-accent-50"
                    : "border-gray-200 bg-white hover:border-accent-200 hover:bg-accent-50/60 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-300/25 dark:hover:bg-accent-300/10"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectConversation(conversation.id)}
                  className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/25"
                >
                  <span className="block truncate text-sm font-bold text-foreground">
                    {conversation.title}
                  </span>
                  {conversation.lastMessagePreview && (
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                      {conversation.lastMessagePreview}
                    </span>
                  )}
                  <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-sand-300/55">
                    {conversation.messageCount} mensajes · {formatConversationDate(conversation.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => archiveConversation(conversation.id)}
                  aria-label="Archivar conversación"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 opacity-100 transition-colors hover:bg-white hover:text-red-600 dark:hover:bg-white/10 dark:hover:text-red-200 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
