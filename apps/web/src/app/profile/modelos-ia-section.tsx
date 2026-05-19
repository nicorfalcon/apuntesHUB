"use client";

import { useState, useEffect } from "react";
import { ApiKeyCard } from "./api-key-card";

export interface UserApiKey {
  id: string;
  provider: string;
  display_name: string;
  model_id: string | null;
  key_hint: string | null;
  created_at: string;
}

export function ModelosIASection() {
  const [keys, setKeys] = useState<UserApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai/api-keys")
      .then((r) => r.json())
      .then((data) => {
        setKeys(data.keys ?? []);
        setLoading(false);
      })
      .catch(() => {
        setFetchError("No se pudieron cargar las API keys.");
        setLoading(false);
      });
  }, []);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/ai/api-keys/${id}`, { method: "DELETE" });
    if (res.ok) {
      setKeys((prev) => prev.filter((k) => k.id !== id));
    }
  };

  const handleAdd = (newKey: UserApiKey) => {
    setKeys((prev) => [...prev, newKey]);
  };

  if (fetchError) {
    return (
      <section className="rounded-2xl border border-gray-200/80 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-[#0f1e1a]">
        <p className="text-sm text-red-600">{fetchError}</p>
      </section>
    );
  }

  return (
    <ApiKeyCard
      userKeys={keys}
      loading={loading}
      onDelete={handleDelete}
      onAdd={handleAdd}
    />
  );
}
