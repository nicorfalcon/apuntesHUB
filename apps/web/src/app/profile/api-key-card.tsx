"use client";

import { useState } from "react";
import { AddKeyForm } from "./add-key-form";
import type { UserApiKey } from "./modelos-ia-section";

const KNOWN_PROVIDERS = [
  { id: "openai", name: "OpenAI", shortLabel: "GPT" },
  { id: "gemini", name: "Google Gemini", shortLabel: "Gem" },
] as const;

interface Props {
  userKeys: UserApiKey[];
  loading: boolean;
  onDelete: (id: string) => Promise<void>;
  onAdd: (key: UserApiKey) => void;
}

export function ApiKeyCard({ userKeys, loading, onDelete, onAdd }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta API key? Esta acción no se puede deshacer.")) return;
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  const customKeys = userKeys.filter(
    (k) => !["openai", "gemini"].includes(k.provider)
  );

  return (
    <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-[#0f1e1a]">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-700 dark:text-accent-100">
        Modelos IA
      </p>
      <h2 className="mt-3 text-xl font-bold tracking-tight text-foreground">
        Tu modelo de inteligencia artificial
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Conectá tu propia API key para usar el modelo de IA de tu preferencia con búsqueda en internet.
      </p>

      {/* Modelo default — siempre visible */}
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-600 text-sm font-bold text-white">
          A
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">apuntesHUB (por defecto)</p>
          <p className="text-xs text-accent-600 dark:text-accent-300">Activo · Llama 3.3 70B</p>
        </div>
        <span className="shrink-0 rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent-700 dark:bg-accent-300/15 dark:text-accent-200">
          Gratis
        </span>
      </div>

      <div className="my-5 border-t border-gray-100 dark:border-white/10" />
      <p className="mb-3 text-sm font-semibold text-foreground">Tus API keys</p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {KNOWN_PROVIDERS.map((provider) => {
            const userKey = userKeys.find((k) => k.provider === provider.id);
            return (
              <div
                key={provider.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-white/10"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-600 dark:bg-white/10 dark:text-sand-300">
                  {provider.shortLabel}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{provider.name}</p>
                  {userKey ? (
                    <p className="text-xs text-accent-600 dark:text-accent-300">
                      ✓ Conectado · {userKey.key_hint}
                      {userKey.model_id && ` · ${userKey.model_id}`}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">Sin configurar</p>
                  )}
                </div>
                {userKey ? (
                  <button
                    onClick={() => handleDelete(userKey.id)}
                    disabled={deletingId === userKey.id}
                    className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {deletingId === userKey.id ? "Eliminando..." : "Eliminar"}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/15 dark:text-sand-300 dark:hover:bg-white/5"
                  >
                    Agregar key
                  </button>
                )}
              </div>
            );
          })}

          {/* Keys custom (no OpenAI ni Gemini) */}
          {customKeys.map((k) => (
            <div
              key={k.id}
              className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-white/10"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-600 dark:bg-white/10 dark:text-sand-300">
                ✦
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{k.display_name}</p>
                <p className="text-xs text-accent-600 dark:text-accent-300">
                  ✓ Conectado · {k.key_hint}
                  {k.model_id && ` · ${k.model_id}`}
                </p>
              </div>
              <button
                onClick={() => handleDelete(k.id)}
                disabled={deletingId === k.id}
                className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {deletingId === k.id ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700 dark:border-white/15 dark:text-sand-300/70 dark:hover:border-accent-400/30 dark:hover:bg-accent-300/10 dark:hover:text-accent-200"
      >
        {showAddForm ? "Cancelar" : "+ Agregar otro proveedor"}
      </button>

      {showAddForm && (
        <AddKeyForm
          onSuccess={(newKey) => {
            onAdd(newKey);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div className="mt-5 flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
        <span className="text-sm">🔒</span>
        <p className="text-xs leading-5 text-gray-500 dark:text-sand-300/70">
          Tus API keys se almacenan cifradas con AES-256-GCM y nunca se comparten con terceros ni se exponen al cliente.
        </p>
      </div>
    </section>
  );
}
