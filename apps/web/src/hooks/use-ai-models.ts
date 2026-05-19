"use client";

import { useState, useEffect } from "react";

export interface AIModel {
  id: string;
  label: string;
  provider: string;
  modelId?: string;
  hasWebSearch: boolean;
}

const PLATFORM_MODEL: AIModel = {
  id: "platform",
  label: "apuntesHUB (por defecto)",
  provider: "platform",
  hasWebSearch: false,
};

export function useAIModels() {
  const [models, setModels] = useState<AIModel[]>([PLATFORM_MODEL]);
  const [selectedModel, setSelectedModel] = useState<AIModel>(PLATFORM_MODEL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ai/api-keys")
      .then((r) => r.json())
      .then((data) => {
        const userModels: AIModel[] = (
          data.keys as Array<{
            id: string;
            display_name: string;
            provider: string;
            model_id: string | null;
          }>
        ).map((k) => ({
          id: k.id,
          label: `${k.display_name} · tu key`,
          provider: k.provider,
          modelId: k.model_id ?? undefined,
          hasWebSearch: true,
        }));

        setModels([PLATFORM_MODEL, ...userModels]);
      })
      .catch(() => {
        // Si falla, solo mostramos el modelo de plataforma
      })
      .finally(() => setLoading(false));
  }, []);

  const goToAddKey = () => {
    // Navegar a la sección Modelos IA del perfil
    window.location.href = "/profile#ai-models";
  };

  return { models, selectedModel, setSelectedModel, loading, goToAddKey };
}
