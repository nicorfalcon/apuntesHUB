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

  it("incluye instrucciones y contexto para preguntas de seguimiento", async () => {
    h.create.mockResolvedValue({
      choices: [{ message: { content: "ok" } }],
    });

    await answerFromContext("me podés explicar más sobre eso", [
      { content: "Le Chatelier aparece en equilibrio químico.", chunkIndex: 0, resumeId: "r-1" },
    ], {
      recentMessages: [{ role: "user", content: "qué es Le Chatelier" }],
    });

    const payload = h.create.mock.calls[0][0];
    const systemMsg = payload.messages.find(
      (m: { role: string }) => m.role === "system"
    );
    const userMsg = payload.messages.find(
      (m: { role: string }) => m.role === "user"
    );
    expect(systemMsg.content).toMatch(/Preguntas de seguimiento/i);
    expect(systemMsg.content).toMatch(/historial reciente/i);
    expect(userMsg.content).toContain("Historial reciente:");
    expect(userMsg.content).toContain("Usuario: qué es Le Chatelier");
    expect(userMsg.content).toContain("Pregunta actual: me podés explicar más sobre eso");
  });

  it("incluye metadata del apunte e instrucciones para ejemplos y términos no literales", async () => {
    h.create.mockResolvedValue({
      choices: [{ message: { content: "ok" } }],
    });

    await answerFromContext("Qué es Chatelier?", [
      {
        content: "Cuando se modifica la temperatura, la presión o la concentración, el equilibrio se desplaza.",
        chunkIndex: 0,
        resumeId: "r-1",
      },
    ], {
      studyMetadata: {
        resumeTitle: "Equilibrio Químico",
        subject: "Química",
        topics: ["Le Chatelier", "equilibrio químico"],
      },
    });

    const payload = h.create.mock.calls[0][0];
    const systemMsg = payload.messages.find(
      (m: { role: string }) => m.role === "system"
    );
    const userMsg = payload.messages.find(
      (m: { role: string }) => m.role === "user"
    );
    expect(systemMsg.content).toContain("Ejemplo ilustrativo:");
    expect(systemMsg.content).toContain("No atribuyas al apunte ejemplos que no estén en el contexto");
    expect(systemMsg.content).toContain("NUNCA inventes números de página");
    expect(systemMsg.content).toContain("no aparece literalmente");
    expect(systemMsg.content).toContain("Según el apunte");
    expect(systemMsg.content).toContain("Esto significa");
    expect(systemMsg.content).toContain("Para practicar");
    expect(userMsg.content).toContain("Temas declarados del apunte: Le Chatelier, equilibrio químico");
  });

  it("incluye el modo de respuesta elegido sin relajar grounding", async () => {
    h.create.mockResolvedValue({
      choices: [{ message: { content: "ok" } }],
    });

    await answerFromContext("haceme preguntas", [
      { content: "El equilibrio puede desplazarse ante perturbaciones.", chunkIndex: 0, resumeId: "r-1" },
    ], {
      answerMode: "quiz",
    });

    const payload = h.create.mock.calls[0][0];
    const systemMsg = payload.messages.find(
      (m: { role: string }) => m.role === "system"
    );
    const userMsg = payload.messages.find(
      (m: { role: string }) => m.role === "user"
    );
    expect(systemMsg.content).toContain("Modo de respuesta: Mini quiz");
    expect(systemMsg.content).toContain("nunca permite saltear las reglas");
    expect(userMsg.content).toContain("Modo de respuesta: Mini quiz");
  });

  it("pide JSON estricto para verdadero/falso sin inventar páginas", async () => {
    h.create.mockResolvedValue({
      choices: [{ message: { content: "{}" } }],
    });

    await answerFromContext("armame verdadero o falso", [
      {
        content: "El equilibrio se desplaza ante cambios de temperatura.",
        chunkIndex: 0,
        resumeId: "r-1",
        pageStart: 1,
        pageEnd: 2,
      },
    ], {
      answerMode: "true_false",
    });

    const payload = h.create.mock.calls[0][0];
    const systemMsg = payload.messages.find(
      (m: { role: string }) => m.role === "system"
    );
    expect(systemMsg.content).toContain('"type": "true_false"');
    expect(systemMsg.content).toContain("ÚNICAMENTE con JSON válido");
    expect(systemMsg.content).toContain("Generá exactamente 3 preguntas");
    expect(systemMsg.content).toContain("No inventes páginas");
    expect(payload.max_tokens).toBe(1100);
  });

  it("pide JSON estricto para multiple choice", async () => {
    h.create.mockResolvedValue({
      choices: [{ message: { content: "{}" } }],
    });

    await answerFromContext("multiple choice", [
      { content: "La concentración afecta el equilibrio.", chunkIndex: 0, resumeId: "r-1" },
    ], {
      answerMode: "multiple_choice",
    });

    const payload = h.create.mock.calls[0][0];
    const systemMsg = payload.messages.find(
      (m: { role: string }) => m.role === "system"
    );
    expect(systemMsg.content).toContain('"type": "multiple_choice"');
    expect(systemMsg.content).toContain('"correctOptionIndex": 0');
    expect(systemMsg.content).toContain("distractores plausibles no ambiguos");
  });

  it("escala max_tokens en modos estructurados según count", async () => {
    h.create.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });

    await answerFromContext("multiple choice", [
      { content: "ctx", chunkIndex: 0, resumeId: "r-1" },
    ], { answerMode: "multiple_choice", count: 3 });
    expect(h.create.mock.calls[0][0].max_tokens).toBe(1100);

    await answerFromContext("multiple choice", [
      { content: "ctx", chunkIndex: 0, resumeId: "r-1" },
    ], { answerMode: "multiple_choice", count: 5 });
    expect(h.create.mock.calls[1][0].max_tokens).toBe(1700);
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
