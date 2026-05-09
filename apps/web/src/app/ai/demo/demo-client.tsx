"use client";

import { useState } from "react";

interface ResumeOption {
  id: string;
  title: string;
  subject: string;
}

interface SearchResult {
  resume_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

export function DemoClient({ resumes }: { resumes: ResumeOption[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSearch() {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          resumeIds: selected.size > 0 ? Array.from(selected) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error desconocido");
      } else {
        setResults(data.results);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Demo Asistente IA</h1>
      <p className="mt-1 text-sm text-gray-500">
        Búsqueda semántica sobre tus apuntes comprados.
      </p>

      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
        <label className="block text-sm font-medium">Pregunta</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && query.trim() && !loading && onSearch()}
          placeholder="Ej: ¿qué es la mitosis?"
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />

        {resumes.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium">Filtrar por apunte (opcional)</p>
            <div className="mt-2 space-y-1">
              {resumes.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                  <span>
                    {r.title}{" "}
                    <span className="text-gray-400">({r.subject})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {resumes.length === 0 && (
          <p className="mt-4 text-sm text-gray-400">
            No tenés apuntes comprados todavía.
          </p>
        )}

        <button
          onClick={onSearch}
          disabled={loading || !query.trim()}
          className="mt-5 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {results && (
        <div className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold">
            Resultados ({results.length})
          </h2>
          {results.length === 0 && (
            <p className="text-sm text-gray-500">
              Sin resultados. Probá con otra pregunta o revisá que el apunte esté ingestado.
            </p>
          )}
          {results.map((r, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>chunk #{r.chunk_index}</span>
                <span>similitud {(r.similarity * 100).toFixed(1)}%</span>
              </div>
              <p className="mt-2 text-sm text-gray-800">{r.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
