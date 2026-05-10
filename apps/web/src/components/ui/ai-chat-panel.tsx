"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
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
        body: JSON.stringify({ query: q, resumeIds: [resumeId] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error desconocido");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
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
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar asistente IA" : "Abrir asistente IA"}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
      >
        <SparkleIcon />
        {open ? "Cerrar IA" : "Asistente IA"}
      </button>

      {/* Panel lateral */}
      {open && (
        <div className="fixed right-0 top-14 z-30 flex h-[calc(100vh-56px)] w-96 flex-col border-l border-gray-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Asistente IA</p>
              <p className="truncate text-xs text-gray-400">{resumeTitle}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar panel"
              className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <XIcon />
            </button>
          </div>

          {!aiReady ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <SparkleIcon />
              </div>
              <p className="text-sm font-medium text-gray-700">Apunte no procesado</p>
              <p className="text-xs leading-relaxed text-gray-400">
                El vendedor todavía no activó el asistente IA para este apunte.
              </p>
            </div>
          ) : (
            <>
              {/* Mensajes */}
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <p className="mt-8 text-center text-xs text-gray-400">
                    Hacé una pregunta sobre este apunte
                  </p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-sm ${
                        m.role === "user"
                          ? "bg-accent-600 text-white"
                          : "border border-gray-200 bg-gray-50 text-gray-800"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400">
                      Pensando...
                    </div>
                  </div>
                )}
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {error}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-gray-100 p-3">
                <div className="flex gap-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
                    placeholder="Preguntá sobre este apunte..."
                    disabled={loading}
                    className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/30 disabled:opacity-40"
                  />
                  <button
                    onClick={onSend}
                    disabled={loading || !query.trim()}
                    className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-40"
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
