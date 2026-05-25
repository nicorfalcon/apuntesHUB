"use client";

import { useState } from "react";
import type { UserApiKey } from "./modelos-ia-section";

const KNOWN_PROVIDERS = [
  { id: "openai", name: "OpenAI", placeholder: "sk-..." },
  { id: "gemini", name: "Google Gemini", placeholder: "AIza..." },
  { id: "custom", name: "Otro (compatible OpenAI)", placeholder: "tu-api-key" },
] as const;

interface ModelOption {
  id: string;
  label: string;
}

const MODEL_OPTIONS: Record<string, ModelOption[]> = {
  openai: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o mini" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  ],
  gemini: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (free tier)" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (requiere billing)" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (requiere billing)" },
  ],
  custom: [],
};

interface Props {
  onSuccess: (key: UserApiKey) => void;
  onCancel: () => void;
}

export function AddKeyForm({ onSuccess, onCancel }: Props) {
  const [provider, setProvider] = useState<string>("openai");
  const [displayName, setDisplayName] = useState("");
  const [modelId, setModelId] = useState(MODEL_OPTIONS.openai[0].id);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleProviderChange = (val: string) => {
    setProvider(val);
    setModelId(MODEL_OPTIONS[val]?.[0]?.id ?? "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError("Ingresá una API key");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          displayName: displayName || KNOWN_PROVIDERS.find((p) => p.id === provider)?.name,
          modelId: modelId || undefined,
          apiKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al guardar la key");
        return;
      }

      onSuccess(data.key as UserApiKey);
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const currentProvider = KNOWN_PROVIDERS.find((p) => p.id === provider);

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <p className="text-sm font-semibold text-foreground">Nueva API key</p>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-sand-300/70">
          Proveedor
        </label>
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-white/15 dark:bg-[#0f1e1a]"
        >
          {KNOWN_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {provider === "custom" && (
        <>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-sand-300/70">
              Nombre del proveedor
            </label>
            <input
              type="text"
              placeholder="ej. Mistral, Groq, Ollama..."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-white/15 dark:bg-[#0f1e1a]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-sand-300/70">
              Modelo (ID exacto)
            </label>
            <input
              type="text"
              placeholder="ej. mistral-large-latest"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-white/15 dark:bg-[#0f1e1a]"
            />
          </div>
        </>
      )}

      {MODEL_OPTIONS[provider]?.length > 0 && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-sand-300/70">
            Modelo
          </label>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-white/15 dark:bg-[#0f1e1a]"
          >
            {MODEL_OPTIONS[provider].map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-sand-300/70">
          API Key
        </label>
        <input
          type="password"
          placeholder={currentProvider?.placeholder ?? "tu-api-key"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          required
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-white/15 dark:bg-[#0f1e1a]"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      {loading && (
        <p className="text-xs text-gray-500 dark:text-sand-300/60">
          Verificando la key con el proveedor...
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-white/15 dark:text-sand-300 dark:hover:bg-white/5"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !apiKey.trim()}
          className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-50"
        >
          {loading ? "Verificando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
