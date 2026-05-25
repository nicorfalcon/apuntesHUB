"use client";

import { useState, useRef, useEffect } from "react";
import { useAIModels } from "@/hooks/use-ai-models";
import { ModelSelector } from "./model-selector";
import { SourcePills } from "./source-pills";
import type { Source } from "./source-pills";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

interface AiChatPanelProps {
  resumeId: string;
  resumeTitle: string;
  aiReady: boolean;
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function AiChatPanel({ resumeId, resumeTitle, aiReady }: AiChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { models, selectedModel, setSelectedModel, loading: modelsLoading, goToAddKey } = useAIModels();

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  async function onSend() {
    const q = query.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuery("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          resumeIds: [resumeId],
          apiKeyId: selectedModel.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Si la key fue eliminada mientras el panel estaba abierto, caer al modelo platform
        if (res.status === 404 && selectedModel.id !== "platform") {
          setSelectedModel(models.find((m) => m.id === "platform") ?? selectedModel);
          setError("La API key ya no existe. Se cambió al modelo por defecto de apuntesHUB.");
        } else {
          setError(data.error ?? "Error desconocido");
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.answer,
            sources: data.sources,
          },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente IA"
          className="fixed bottom-4 right-4 z-40 flex min-h-11 items-center gap-2 rounded-full bg-accent-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200 sm:bottom-6 sm:right-6 sm:px-4"
        >
          <SparkleIcon />
          <span className="hidden sm:inline">Asistente IA</span>
        </button>
      )}

      {/* Panel lateral */}
      {open && (
        <div className="fixed inset-x-0 top-14 z-50 flex h-[calc(100svh-56px)] flex-col border-l border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0f1e1a] dark:shadow-black/35 sm:left-auto sm:right-0 sm:w-[min(24rem,calc(100vw-2rem))]">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-white/10">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Asistente IA</p>
              <p className="truncate text-xs text-gray-400 dark:text-sand-300/65">{resumeTitle}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar panel"
              className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-sand-300/65 dark:hover:bg-white/10 dark:hover:text-sand-50"
            >
              <XIcon />
            </button>
          </div>

          {!aiReady ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-sand-300/65">
                <SparkleIcon />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-sand-50">Apunte no procesado</p>
              <p className="text-xs leading-relaxed text-gray-400 dark:text-sand-300/65">
                El vendedor todavía no activó el asistente IA para este apunte.
              </p>
            </div>
          ) : (
            <>
              {/* Selector de modelo */}
              {!modelsLoading && (
                <ModelSelector
                  models={models}
                  selected={selectedModel}
                  onChange={setSelectedModel}
                  onAddKey={goToAddKey}
                />
              )}

              {/* Mensajes */}
              <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
                {messages.length === 0 && (
                  <p className="mt-8 text-center text-xs text-gray-400 dark:text-sand-300/65">
                    {selectedModel.hasWebSearch
                      ? "Preguntá sobre el apunte o cualquier tema relacionado. Voy a combinar el apunte con búsqueda en internet."
                      : "Hacé una pregunta sobre este apunte"}
                  </p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start"}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-sm ${
                        m.role === "user"
                          ? "bg-accent-600 text-white dark:bg-accent-300 dark:text-[#071713]"
                          : "border border-gray-200 bg-gray-50 text-gray-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-sand-50"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                    {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                      <SourcePills sources={m.sources} />
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-sand-300/65">
                      Pensando…
                    </div>
                  </div>
                )}
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
                    {error}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-gray-100 p-3 dark:border-white/10">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
                    placeholder={
                      selectedModel.hasWebSearch
                        ? "Preguntá sobre el apunte o cualquier tema…"
                        : "Preguntá sobre este apunte…"
                    }
                    disabled={loading}
                    className="min-h-10 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500/30 disabled:opacity-40 dark:border-white/15 dark:bg-white/5 dark:placeholder:text-sand-300/45 dark:focus:ring-accent-300/20"
                  />
                  <button
                    onClick={onSend}
                    disabled={loading || !query.trim()}
                    className="min-h-10 rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-40 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
                  >
                    Enviar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
