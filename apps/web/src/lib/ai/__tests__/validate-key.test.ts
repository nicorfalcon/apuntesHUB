import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateApiKey } from "../validate-key";

// validateApiKey pega contra el endpoint del proveedor (dependencia externa: la
// red). Mockeamos global.fetch para no salir a internet y controlar la respuesta.
describe("validateApiKey", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("provider: openai", () => {
    it("dado que la API responde ok, entonces la key es válida", async () => {
      fetchMock.mockResolvedValue({ ok: true });

      const result = await validateApiKey("openai", "sk-test");

      expect(result).toBe(true);
      // Llama al endpoint de modelos con el Bearer correcto.
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.openai.com/v1/models");
      expect(init.headers.Authorization).toBe("Bearer sk-test");
    });

    it("dado que la API responde no-ok, entonces la key es inválida", async () => {
      fetchMock.mockResolvedValue({ ok: false });

      expect(await validateApiKey("openai", "sk-bad")).toBe(false);
    });
  });

  describe("provider: gemini", () => {
    it("dado que la API responde ok, entonces la key es válida", async () => {
      fetchMock.mockResolvedValue({ ok: true });

      const result = await validateApiKey("gemini", "g-key");

      expect(result).toBe(true);
      // La key viaja en el query string del endpoint v1beta.
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("generativelanguage.googleapis.com/v1beta/models");
      expect(url).toContain("key=g-key");
    });

    it("dado que la API responde no-ok, entonces la key es inválida", async () => {
      fetchMock.mockResolvedValue({ ok: false });

      expect(await validateApiKey("gemini", "g-bad")).toBe(false);
    });
  });

  describe("provider: custom", () => {
    it("dado un key de formato razonable (>10 chars), entonces lo acepta sin pegarle a la red", async () => {
      const result = await validateApiKey("custom", "esta-clave-es-larga");

      expect(result).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("dado un key demasiado corto, entonces lo rechaza", async () => {
      expect(await validateApiKey("custom", "corta")).toBe(false);
    });
  });

  it("dado un proveedor desconocido, entonces devuelve false", async () => {
    expect(await validateApiKey("anthropic", "lo-que-sea")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dado que fetch lanza (timeout/red caída), entonces devuelve false sin propagar", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    expect(await validateApiKey("openai", "sk-test")).toBe(false);
  });
});
