export async function validateApiKey(
  provider: string,
  apiKey: string,
  modelId?: string
): Promise<boolean> {
  try {
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    }

    if (provider === "gemini") {
      // AI Studio keys usan v1beta; listar modelos es más confiable que pedir uno específico
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=1`,
        { signal: AbortSignal.timeout(10_000) }
      );
      return res.ok;
    }

    if (provider === "custom") {
      // Sin endpoint conocido, aceptar si el formato parece razonable
      return apiKey.length > 10;
    }

    return false;
  } catch {
    return false;
  }
}
