import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { callUserModel } from "../model-router";

// callUserModel depende de fetch (red, servicio de terceros). Reemplazamos
// global.fetch por un doble:
//  - como STUB: le programamos la respuesta que queremos (ok/error, json).
//  - como SPY: verificamos con qué URL y body se lo llamó.
function stubFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const mock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("callUserModel", () => {
  describe("proveedor openai", () => {
    it("devuelve el contenido del primer choice cuando la respuesta es OK", async () => {
      // given
      stubFetch({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "respuesta IA" } }] }),
      });

      // when
      const result = await callUserModel({
        provider: "openai",
        modelId: null,
        apiKey: "sk-test",
        prompt: "hola",
      });

      // then
      expect(result).toEqual({ text: "respuesta IA" });
    });

    it("llama al endpoint de OpenAI con el header de autorización y el prompt", async () => {
      // given
      const fetchMock = stubFetch({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "x" } }] }),
      });

      // when
      await callUserModel({
        provider: "openai",
        modelId: null,
        apiKey: "sk-secreta",
        prompt: "mi pregunta",
      });

      // then: el spy verifica la interacción
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      expect((options as RequestInit).headers).toMatchObject({
        Authorization: "Bearer sk-secreta",
      });
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.model).toBe("gpt-4o"); // default cuando modelId es null
      expect(body.messages).toEqual([{ role: "user", content: "mi pregunta" }]);
    });

    it("usa el modelId provisto en lugar del default", async () => {
      // given
      const fetchMock = stubFetch({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "x" } }] }),
      });

      // when
      await callUserModel({
        provider: "openai",
        modelId: "gpt-4o-mini",
        apiKey: "sk",
        prompt: "p",
      });

      // then
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.model).toBe("gpt-4o-mini");
    });

    it("lanza error con el mensaje del proveedor cuando la respuesta no es OK", async () => {
      // given
      stubFetch({
        ok: false,
        statusText: "Unauthorized",
        json: async () => ({ error: { message: "API key inválida" } }),
      });

      // when / then
      await expect(
        callUserModel({ provider: "openai", modelId: null, apiKey: "mala", prompt: "p" })
      ).rejects.toThrow("Error del proveedor IA (openai): API key inválida");
    });

    it("cae al statusText cuando el cuerpo de error no se puede parsear", async () => {
      // given
      stubFetch({
        ok: false,
        statusText: "Bad Gateway",
        json: async () => {
          throw new Error("no json");
        },
      });

      // when / then
      await expect(
        callUserModel({ provider: "openai", modelId: null, apiKey: "k", prompt: "p" })
      ).rejects.toThrow("Error del proveedor IA (openai): Bad Gateway");
    });
  });

  describe("proveedor gemini", () => {
    it("devuelve el texto del primer candidate cuando la respuesta es OK", async () => {
      // given
      stubFetch({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "respuesta gemini" }] } }],
        }),
      });

      // when
      const result = await callUserModel({
        provider: "gemini",
        modelId: null,
        apiKey: "key-gemini",
        prompt: "hola",
      });

      // then
      expect(result).toEqual({ text: "respuesta gemini" });
    });

    it("incluye el modelo y la api key en la URL de Gemini", async () => {
      // given
      const fetchMock = stubFetch({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "x" }] } }],
        }),
      });

      // when
      await callUserModel({
        provider: "gemini",
        modelId: "gemini-2.5-pro",
        apiKey: "key-123",
        prompt: "p",
      });

      // then
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("models/gemini-2.5-pro:generateContent");
      expect(url).toContain("key=key-123");
    });

    it("lanza error de Gemini cuando la respuesta no es OK", async () => {
      // given
      stubFetch({
        ok: false,
        statusText: "Forbidden",
        json: async () => ({ error: { message: "cuota excedida" } }),
      });

      // when / then
      await expect(
        callUserModel({ provider: "gemini", modelId: null, apiKey: "k", prompt: "p" })
      ).rejects.toThrow("Error de Gemini: cuota excedida");
    });
  });

  describe("proveedor no soportado", () => {
    it("lanza error y no realiza ninguna llamada de red", async () => {
      // given
      const fetchMock = stubFetch({ ok: true, json: async () => ({}) });

      // when / then
      await expect(
        callUserModel({ provider: "anthropic", modelId: null, apiKey: "k", prompt: "p" })
      ).rejects.toThrow("Proveedor no soportado: anthropic");

      // el spy confirma que ni siquiera se intentó el fetch
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
