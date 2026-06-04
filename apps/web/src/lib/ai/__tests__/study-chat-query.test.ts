import { describe, expect, it } from "vitest";
import { rewriteStudyChatQuery } from "../study-chat-query";

describe("rewriteStudyChatQuery", () => {
  it("reescribe 'me podés explicar más sobre eso' con la última pregunta específica", () => {
    const result = rewriteStudyChatQuery({
      latestUserMessage: "me podés explicar más sobre eso",
      recentMessages: [{ role: "user", content: "qué es Le Chatelier" }],
      resumeTitle: "Equilibrio Químico",
    });

    expect(result.wasRewritten).toBe(true);
    expect(result.retrievalQuery).toContain("Le Chatelier");
    expect(result.retrievalQuery).toContain("Equilibrio Químico");
  });

  it("reescribe 'dame un ejemplo' con el tema de la última respuesta", () => {
    const result = rewriteStudyChatQuery({
      latestUserMessage: "dame un ejemplo",
      recentMessages: [
        {
          role: "assistant",
          content:
            "El principio de Le Chatelier explica cómo responde un sistema en equilibrio ante cambios de concentración, presión o temperatura.",
        },
      ],
      subject: "Química",
    });

    expect(result.wasRewritten).toBe(true);
    expect(result.retrievalQuery).toMatch(/Le Chatelier/i);
  });

  it.each([
    "y qué pasa si aumento la temperatura?",
    "y que pasa si aumento la temperatura?",
  ])("reescribe '%s' como follow-up del tema anterior", (latestUserMessage) => {
    const result = rewriteStudyChatQuery({
      latestUserMessage,
      recentMessages: [{ role: "user", content: "qué es Le Chatelier" }],
      resumeTitle: "Equilibrio Químico",
    });

    expect(result.wasRewritten).toBe(true);
    expect(result.retrievalQuery).toMatch(/chatelier/i);
    expect(result.retrievalQuery).toMatch(/temperatura/i);
  });

  it("no contamina una pregunta específica nueva con el tema anterior", () => {
    const result = rewriteStudyChatQuery({
      latestUserMessage: "qué es el equilibrio dinámico",
      recentMessages: [{ role: "user", content: "qué es Le Chatelier" }],
      resumeTitle: "Equilibrio Químico",
    });

    expect(result.wasRewritten).toBe(false);
    expect(result.retrievalQuery).toBe("qué es el equilibrio dinámico");
  });

  it("sin historial deja la pregunta original", () => {
    const result = rewriteStudyChatQuery({
      latestUserMessage: "me explicás más sobre eso",
      recentMessages: [],
    });

    expect(result.wasRewritten).toBe(false);
    expect(result.retrievalQuery).toBe("me explicás más sobre eso");
  });

  it("recorta historial largo y usa solo mensajes recientes", () => {
    const result = rewriteStudyChatQuery({
      latestUserMessage: "explicame más",
      recentMessages: [
        { role: "user", content: "qué es Le Chatelier" },
        { role: "assistant", content: "Respuesta vieja." },
        { role: "user", content: "qué es concentración" },
        { role: "assistant", content: "Respuesta vieja." },
        { role: "user", content: "qué es temperatura" },
        { role: "assistant", content: "Respuesta vieja." },
        { role: "user", content: "qué es Kc" },
      ],
    });

    expect(result.wasRewritten).toBe(true);
    expect(result.retrievalQuery).toContain("Kc");
    expect(result.retrievalQuery).not.toContain("Le Chatelier");
  });

  it("no excede la longitud máxima", () => {
    const result = rewriteStudyChatQuery({
      latestUserMessage: "me podés explicar más sobre eso",
      recentMessages: [{ role: "user", content: `qué es ${"Le Chatelier ".repeat(40)}` }],
      resumeTitle: "Equilibrio Químico ".repeat(20),
      subject: "Química ".repeat(20),
    });

    expect(result.retrievalQuery.length).toBeLessThanOrEqual(320);
  });
});
