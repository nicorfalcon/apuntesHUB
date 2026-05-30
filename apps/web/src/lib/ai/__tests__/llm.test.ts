import { describe, it, expect, beforeEach, vi } from "vitest";

// Mockeamos el SDK de Groq. Validamos que answerFromContext arma el
// payload correctamente (system prompt con las reglas, user con fragmentos
// numerados + pregunta) y propaga la respuesta.

const h = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create: h.create } };
  },
}));

import { answerFromContext } from "../llm";

beforeEach(() => {
  h.create.mockReset();
  vi.stubEnv("GROQ_API_KEY", "key-1");
});

describe("answerFromContext", () => {
  it("dado una pregunta y fragmentos, entonces devuelve el content del primer choice", async () => {
    h.create.mockResolvedValue({
      choices: [{ message: { content: "Respuesta concreta" } }],
    });

    const answer = await answerFromContext("¿Qué es X?", [
      { content: "X es un concepto.", chunkIndex: 0, resumeId: "r-1" },
    ]);

    expect(answer).toBe("Respuesta concreta");
  });

  it("numera los fragmentos en el user prompt como [Fragmento N]", async () => {
    h.create.mockResolvedValue({
      choices: [{ message: { content: "ok" } }],
    });

    await answerFromContext("¿algo?", [
      { content: "primer chunk", chunkIndex: 0, resumeId: "r-1" },
      { content: "segundo chunk", chunkIndex: 1, resumeId: "r-1" },
    ]);

    const payload = h.create.mock.calls[0][0];
    const userMsg = payload.messages.find(
      (m: { role: string }) => m.role === "user"
    );
    expect(userMsg.content).toContain("[Fragmento 1]");
    expect(userMsg.content).toContain("[Fragmento 2]");
    expect(userMsg.content).toContain("primer chunk");
    expect(userMsg.content).toContain("segundo chunk");
  });

  it("el system prompt incluye las reglas de no copiar textual y rechazar listar/transcribir", async () => {
    h.create.mockResolvedValue({
      choices: [{ message: { content: "ok" } }],
    });

    await answerFromContext("x", [
      { content: "y", chunkIndex: 0, resumeId: "r-1" },
    ]);
    const payload = h.create.mock.calls[0][0];
    const systemMsg = payload.messages.find(
      (m: { role: string }) => m.role === "system"
    );
    expect(systemMsg.content).toMatch(/NUNCA copies más de una oración/i);
    expect(systemMsg.content).toMatch(/listar.*transcribir/i);
  });

  it("usa temperature 0.3 y max_tokens 800", async () => {
    h.create.mockResolvedValue({
      choices: [{ message: { content: "ok" } }],
    });

    await answerFromContext("x", [
      { content: "y", chunkIndex: 0, resumeId: "r-1" },
    ]);
    expect(h.create).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.3, max_tokens: 800 })
    );
  });

  it("dado que el SDK devuelve choices vacío, entonces devuelve el fallback", async () => {
    h.create.mockResolvedValue({ choices: [] });
    const answer = await answerFromContext("x", [
      { content: "y", chunkIndex: 0, resumeId: "r-1" },
    ]);
    expect(answer).toBe("No se pudo generar una respuesta.");
  });

  it("dado que falta GROQ_API_KEY, entonces lanza error", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    await expect(
      answerFromContext("x", [
        { content: "y", chunkIndex: 0, resumeId: "r-1" },
      ])
    ).rejects.toThrow(/GROQ_API_KEY/);
  });
});
