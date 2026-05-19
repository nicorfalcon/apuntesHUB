interface CallOptions {
  provider: string;
  modelId: string | null;
  apiKey: string;
  prompt: string;
}

export async function callUserModel(options: CallOptions): Promise<{ text: string }> {
  const { provider, modelId, apiKey, prompt } = options;
  const TIMEOUT = 30_000;

  if (provider === "openai" || provider === "custom") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId || "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err as { error?: { message?: string } }).error?.message ?? res.statusText;
      throw new Error(`Error del proveedor IA (${provider}): ${msg}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    return { text: data.choices[0].message.content };
  }

  if (provider === "gemini") {
    const model = modelId || "gemini-2.5-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}&alt=json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2000, temperature: 0.3 },
        }),
        signal: AbortSignal.timeout(TIMEOUT),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err as { error?: { message?: string } }).error?.message ?? res.statusText;
      throw new Error(`Error de Gemini: ${msg}`);
    }

    const data = await res.json() as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };
    return { text: data.candidates[0].content.parts[0].text };
  }

  throw new Error(`Proveedor no soportado: ${provider}`);
}
