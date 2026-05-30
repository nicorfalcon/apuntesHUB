import { describe, it, expect, beforeEach, vi } from "vitest";
import { searchWeb } from "../web-search";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SERPER_API_KEY", "key-1");
});

describe("searchWeb", () => {
  it("dado que falta SERPER_API_KEY, entonces devuelve [] sin pegarle al backend", async () => {
    vi.stubEnv("SERPER_API_KEY", "");
    const result = await searchWeb("q");
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dado un response no ok, entonces devuelve []", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    expect(await searchWeb("q")).toEqual([]);
  });

  it("dado un fetch que tira excepción, entonces devuelve [] (no propaga)", async () => {
    fetchMock.mockRejectedValue(new Error("timeout"));
    expect(await searchWeb("q")).toEqual([]);
  });

  it("dado resultados organic, entonces los mapea a WebResult con hostname limpio y truncados a 4", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        organic: [
          {
            title: "Wikipedia",
            link: "https://www.wikipedia.org/wiki/X",
            snippet: "s1",
          },
          { title: "B", link: "https://b.com/y", snippet: "s2" },
          { title: "C", link: "https://c.com/z", snippet: "s3" },
          { title: "D", link: "https://d.com/w", snippet: "s4" },
          { title: "E", link: "https://e.com/v", snippet: "s5" },
        ],
      }),
    });

    const result = await searchWeb("q");
    expect(result).toHaveLength(4);
    // El prefijo "www." se quita del source.
    expect(result[0]).toEqual({
      title: "Wikipedia",
      url: "https://www.wikipedia.org/wiki/X",
      snippet: "s1",
      source: "wikipedia.org",
    });
  });

  it("dado un resultado sin snippet, entonces lo reemplaza por string vacío", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        organic: [{ title: "A", link: "https://a.com/" }],
      }),
    });
    const result = await searchWeb("q");
    expect(result[0].snippet).toBe("");
  });

  it("manda al backend el query, locale gl=ar y lang hl=es", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ organic: [] }),
    });
    await searchWeb("le chatelier");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ q: "le chatelier", num: 5, gl: "ar", hl: "es" });
  });
});
