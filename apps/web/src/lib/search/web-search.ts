export interface WebResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export async function searchWeb(query: string): Promise<WebResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 5, gl: "ar", hl: "es" }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return [];

    const data = await res.json();

    return ((data.organic as Array<{ title: string; link: string; snippet: string }>) ?? [])
      .slice(0, 4)
      .map((r) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet ?? "",
        source: new URL(r.link).hostname.replace("www.", ""),
      }));
  } catch {
    return [];
  }
}
