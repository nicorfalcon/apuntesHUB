import { describe, expect, it } from "vitest";
import {
  cleanTopicTitle,
  suggestTopics,
  topicsFromIndexText,
  topicsFromOutline,
  type OutlineTopicNode,
} from "../topic-extraction";

describe("topic-extraction · outline", () => {
  // Outline real del caso "Lógica Computacional": mezcla bookmarks buenos con
  // los encabezados por página que generaba temas basura.
  const outline: OutlineTopicNode[] = [
    { title: "Índice general" },
    { title: "Índice general Lógica Computacional Página ii" },
    { title: "Índice general Lógica Computacional Página iii" },
    { title: "Introducción, colaboración y agradecimientos" },
    {
      title: "Repaso de Álgebra",
      items: [
        { title: "Producto cartesiano" },
        { title: "Relaciones", items: [{ title: "Partición" }] },
      ],
    },
    {
      title: "Cardinalidad",
      items: [
        { title: "Cardinalidad Lógica Computacional Página 12" },
        { title: "Cardinalidad Lógica Computacional Página 13" },
        { title: "Coordinable" },
      ],
    },
  ];

  it("descarta los encabezados por página y el índice genérico", () => {
    const topics = topicsFromOutline(outline, 2);
    expect(topics).not.toContain("Índice general");
    expect(topics.some((t) => /Página/i.test(t))).toBe(false);
  });

  it("conserva capítulos y secciones reales (hasta 2 niveles)", () => {
    const topics = topicsFromOutline(outline, 2);
    expect(topics).toContain("Introducción, colaboración y agradecimientos");
    expect(topics).toContain("Repaso de Álgebra");
    expect(topics).toContain("Producto cartesiano");
    expect(topics).toContain("Cardinalidad");
    expect(topics).toContain("Coordinable");
    // "Partición" está en nivel 3 → excluido con maxDepth=2
    expect(topics).not.toContain("Partición");
  });

  it("incluye nivel 3 si se pide maxDepth mayor", () => {
    expect(topicsFromOutline(outline, 3)).toContain("Partición");
  });

  it("devuelve vacío para outline vacío o inválido", () => {
    expect(topicsFromOutline([])).toEqual([]);
    // @ts-expect-error probamos entrada inválida
    expect(topicsFromOutline(null)).toEqual([]);
  });
});

describe("topic-extraction · cleanTopicTitle", () => {
  it("quita líderes de puntos y número de página", () => {
    expect(cleanTopicTitle("Producto cartesiano . . . . 1")).toBe(
      "Producto cartesiano"
    );
    expect(cleanTopicTitle("Teorema de Cantor . . . 24")).toBe(
      "Teorema de Cantor"
    );
  });

  it("quita numeración de sección al inicio", () => {
    expect(cleanTopicTitle("1.2. Relaciones")).toBe("Relaciones");
    expect(cleanTopicTitle("3.3.4. Teorema")).toBe("Teorema");
  });

  it("no rompe títulos limpios", () => {
    expect(cleanTopicTitle("Cardinalidad")).toBe("Cardinalidad");
  });
});

describe("topic-extraction · texto de índice (fallback)", () => {
  const indexText = [
    "Índice general Lógica Computacional Página iii",
    "1. Repaso de Álgebra 1",
    "1.1. Producto cartesiano . . . . . . . . . 1",
    "1.2. Relaciones . . . . . . . . . . . . . . 1",
    "2. Cardinalidad 11",
    "2.1. Coordinable . . . . . . . . . . . . . 11",
  ].join("\n");

  it("parsea líneas de TOC y descarta el encabezado corrido", () => {
    const topics = topicsFromIndexText(indexText);
    expect(topics).toContain("Repaso de Álgebra");
    expect(topics).toContain("Producto cartesiano");
    expect(topics).toContain("Relaciones");
    expect(topics).toContain("Cardinalidad");
    expect(topics).toContain("Coordinable");
    expect(topics.some((t) => /Página/i.test(t))).toBe(false);
  });
});

describe("topic-extraction · suggestTopics", () => {
  it("prioriza el outline cuando existe", () => {
    const topics = suggestTopics({
      outline: [{ title: "Repaso de Álgebra" }],
      indexText: "9.9. Otro tema . . . 3",
    });
    expect(topics).toEqual(["Repaso de Álgebra"]);
  });

  it("cae al texto si el outline no aporta temas", () => {
    const topics = suggestTopics({
      outline: [{ title: "Índice general Lógica Computacional Página ii" }],
      indexText: "1.1. Producto cartesiano . . . 1",
    });
    expect(topics).toEqual(["Producto cartesiano"]);
  });
});
