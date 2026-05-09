"use client";

import { useState } from "react";

interface ResumeOption {
  id: string;
  title: string;
  subject: string;
}

interface ChatSource {
  resumeId: string;
  chunkIndex: number;
  similarity: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

export function DemoClient({ resumes }: { resumes: ResumeOption[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
          resumeIds: selected.size > 0 ? Array.from(selected) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error desconocido");
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer, sources: data.sources },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const resumeTitle = (id: string) =>
    resumes.find((r) => r.id === id)?.title ?? id.slice(0, 8) + "…";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Asistente IA</h1>
      <p className="mt-1 text-sm text-gray-500">
        Hacé preguntas sobre tus apuntes comprados.
      </p>

      {/* Selector de apuntes */}
      {resumes.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium">Filtrar por apunte (opcional)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {resumes.map((r) => (
              <button
                key={r.id}
                onClick={() => toggle(r.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selected.has(r.id)
                    ? "border-black bg-black text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                }`}
              >
                {r.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {resumes.length === 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
          No tenés apuntes comprados todavía.
        </div>
      )}

      {/* Historial de mensajes */}
      {messages.length > 0 && (
        <div className="mt-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  m.role === "user"
                    ? "bg-black text-white"
                    : "border border-gray-200 bg-white text-gray-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 border-t border-gray-100 pt-2">
                    <p className="text-xs text-gray-400">
                      Fuentes:{" "}
                      {m.sources.map((s, j) => (
                        <span key={j}>
                          {j > 0 && ", "}
                          {resumeTitle(s.resumeId)} ({(s.similarity * 100).toFixed(0)}%)
                        </span>
                      ))}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400">
                Pensando...
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="mt-6 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
          placeholder="Hacé una pregunta sobre tus apuntes..."
          disabled={loading || resumes.length === 0}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-40"
        />
        <button
          onClick={onSend}
          disabled={loading || !query.trim() || resumes.length === 0}
          className="rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
