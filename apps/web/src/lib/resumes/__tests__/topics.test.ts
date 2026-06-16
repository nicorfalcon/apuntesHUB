import { describe, it, expect } from "vitest";
import {
  normalizeResumeTopic,
  normalizeResumeTopics,
  resumeTopicKey,
  MAX_RESUME_TOPICS,
  MAX_RESUME_TOPIC_LENGTH,
} from "../topics";

describe("normalizeResumeTopic", () => {
  it("hace trim de espacios al inicio/fin", () => {
    expect(normalizeResumeTopic("  Le Chatelier  ")).toBe("Le Chatelier");
  });

  it("colapsa espacios internos", () => {
    expect(normalizeResumeTopic("equilibrio   químico")).toBe(
      "equilibrio químico"
    );
  });

  it("preserva acentos en el valor mostrado", () => {
    expect(normalizeResumeTopic("normalización")).toBe("normalización");
  });

  it("quita caracteres de control", () => {
    expect(normalizeResumeTopic("le\tcha\ntelier")).toBe("le cha telier");
  });

  it("quita etiquetas HTML/script", () => {
    expect(normalizeResumeTopic("<script>alert(1)</script>sockets")).toBe(
      "alert(1) sockets"
    );
    expect(normalizeResumeTopic("<b>3FN</b>")).toBe("3FN");
  });

  it("descarta temas demasiado cortos (< 2 chars)", () => {
    expect(normalizeResumeTopic("a")).toBe("");
    expect(normalizeResumeTopic(" x ")).toBe("");
  });

  it("descarta temas que superan el largo máximo", () => {
    const long = "a".repeat(MAX_RESUME_TOPIC_LENGTH + 1);
    expect(normalizeResumeTopic(long)).toBe("");
    const exact = "a".repeat(MAX_RESUME_TOPIC_LENGTH);
    expect(normalizeResumeTopic(exact)).toBe(exact);
  });

  it("devuelve '' ante entradas no-string", () => {
    // @ts-expect-error probando robustez en runtime
    expect(normalizeResumeTopic(123)).toBe("");
    // @ts-expect-error probando robustez en runtime
    expect(normalizeResumeTopic(null)).toBe("");
  });
});

describe("resumeTopicKey", () => {
  it("es case-insensitive y accent-insensitive", () => {
    expect(resumeTopicKey("Le Chatelier")).toBe(resumeTopicKey("le chatelier"));
    expect(resumeTopicKey("equilibrio químico")).toBe(
      resumeTopicKey("EQUILIBRIO QUIMICO")
    );
  });
});

describe("normalizeResumeTopics", () => {
  it("normaliza, deduplica y conserva el orden (ejemplo del spec)", () => {
    const input = [" Le Chatelier ", "le chatelier", "equilibrio  químico"];
    expect(normalizeResumeTopics(input)).toEqual([
      "Le Chatelier",
      "equilibrio químico",
    ]);
  });

  it("deduplica case-insensitive (gana la primera aparición)", () => {
    expect(normalizeResumeTopics(["Sockets", "sockets", "SOCKETS"])).toEqual([
      "Sockets",
    ]);
  });

  it("deduplica accent-insensitive", () => {
    expect(
      normalizeResumeTopics(["Presión", "presion", "PRESIÓN"])
    ).toEqual(["Presión"]);
  });

  it("elimina vacíos e inválidos", () => {
    expect(
      normalizeResumeTopics(["  ", "x", "árboles binarios", ""])
    ).toEqual(["árboles binarios"]);
  });

  it("preserva el orden del usuario", () => {
    expect(
      normalizeResumeTopics(["scheduling", "sockets", "3FN"])
    ).toEqual(["scheduling", "sockets", "3FN"]);
  });

  it("acota a MAX_RESUME_TOPICS temas", () => {
    const many = Array.from({ length: MAX_RESUME_TOPICS + 5 }, (_, i) => `tema-${i}`);
    const result = normalizeResumeTopics(many);
    expect(result).toHaveLength(MAX_RESUME_TOPICS);
    expect(result[0]).toBe("tema-0");
    expect(result[MAX_RESUME_TOPICS - 1]).toBe(`tema-${MAX_RESUME_TOPICS - 1}`);
  });

  it("devuelve [] ante entradas no-array", () => {
    expect(normalizeResumeTopics(null)).toEqual([]);
    expect(normalizeResumeTopics("le chatelier")).toEqual([]);
  });

  it("ignora elementos no-string dentro del array", () => {
    expect(normalizeResumeTopics(["sockets", 42, null, "3FN"])).toEqual([
      "sockets",
      "3FN",
    ]);
  });
});
