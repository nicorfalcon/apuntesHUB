import { describe, it, expect } from "vitest";
import {
  deriveChunkTerms,
  deriveAcademicAliases,
  normalizeSectionTitles,
  MAX_CHUNK_TERMS,
  MAX_CHUNK_TERM_LENGTH,
  MAX_ACADEMIC_ALIASES,
  MAX_SECTION_TITLES,
  MAX_SECTION_TITLE_LENGTH,
} from "../chunk-terms";

describe("deriveChunkTerms", () => {
  it("devuelve [] cuando no hay chunks", () => {
    expect(deriveChunkTerms([])).toEqual([]);
  });

  it("no rompe ni indexa nada si un apunte no tiene contenido aprovechable", () => {
    expect(deriveChunkTerms([null, undefined, "", "   "])).toEqual([]);
  });

  it("encuentra 'le chatelier' aunque aparezca una sola vez en un chunk", () => {
    const terms = deriveChunkTerms([
      "El principio de Le Châtelier describe el equilibrio químico.",
    ]);
    expect(terms).toContain("le chatelier");
  });

  it("captura conceptos multi-palabra útiles y normaliza acentos", () => {
    const terms = deriveChunkTerms([
      "El Principio de Le Châtelier y la constante de equilibrio en cinética química. " +
        "El equilibrio químico depende de la constante de equilibrio.",
    ]);
    expect(terms).toContain("le chatelier");
    expect(terms).toContain("equilibrio quimico");
    expect(terms).toContain("constante de equilibrio");
    // Sin acentos en ningún término.
    expect(terms.every((t) => t === t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))).toBe(
      true
    );
  });

  it("no indexa contenido completo: cada término es corto", () => {
    const longParagraph =
      "Este es un párrafo extenso con muchísimas palabras que jamás debería " +
      "guardarse completo en el índice porque expondría contenido del PDF y " +
      "violaría las reglas de seguridad de la PoC de búsqueda pública.";
    const terms = deriveChunkTerms([longParagraph]);
    for (const term of terms) {
      expect(term.length).toBeLessThanOrEqual(MAX_CHUNK_TERM_LENGTH);
    }
    // No debe contener el párrafo completo.
    expect(terms).not.toContain(longParagraph.toLowerCase());
  });

  it("limita la cantidad de términos a MAX_CHUNK_TERMS", () => {
    const words = Array.from({ length: 400 }, (_, i) => `concepto${i}`);
    // Repetimos para superar el umbral de frecuencia de unigramas.
    const content = `${words.join(" ")} ${words.join(" ")}`;
    const terms = deriveChunkTerms([content]);
    expect(terms.length).toBeLessThanOrEqual(MAX_CHUNK_TERMS);
  });

  it("deduplica términos repetidos", () => {
    const terms = deriveChunkTerms([
      "equilibrio quimico equilibrio quimico equilibrio quimico",
      "equilibrio quimico otra vez equilibrio quimico",
    ]);
    const unique = new Set(terms);
    expect(unique.size).toBe(terms.length);
    expect(terms).toContain("equilibrio quimico");
  });

  it("descarta términos puramente genéricos/stopwords", () => {
    const terms = deriveChunkTerms([
      "apunte resumen parcial final unidad de la el los las",
    ]);
    expect(terms).not.toContain("apunte");
    expect(terms).not.toContain("resumen");
    expect(terms).not.toContain("de la");
  });
});

describe("deriveAcademicAliases", () => {
  // chunkTerms reales del caso "Equilibrio Quimico" (el PDF NO contiene
  // literalmente "chatelier"): son las señales que deben disparar el alias.
  const equilibrioChunkTerms = [
    "se desplaza",
    "variacion en la concentracion",
    "concentracion",
    "temperature",
    "cte de equilibria",
    "perturbation",
    "factores determinantes",
    "equilibrio",
  ];

  it("genera 'le chatelier' para un apunte de Química con señales de equilibrio", () => {
    const aliases = deriveAcademicAliases({
      title: "Equilibrio Quimico",
      subject: "Quimica",
      description: null,
      chunkTerms: equilibrioChunkTerms,
    });
    expect(aliases).toContain("le chatelier");
    expect(aliases).toContain("principio de le chatelier");
    expect(aliases).toContain("chatelier");
    expect(aliases).toContain("desplazamiento del equilibrio");
    expect(aliases).toContain("perturbacion del equilibrio");
  });

  it("genera 'le chatelier' para OTRO apunte de equilibrio químico con título distinto", () => {
    // Generalidad: no depende del título exacto "Equilibrio Quimico" ni del
    // archivo original; basta con señales suficientes (incluida 1 específica).
    const aliases = deriveAcademicAliases({
      title: "Unidad 4 - Reacciones reversibles",
      subject: null,
      description: null,
      chunkTerms: [
        "se desplaza el equilibrio",
        "variacion de concentracion",
        "efecto de la temperatura",
        "constante de equilibrio",
      ],
    });
    expect(aliases).toContain("le chatelier");
  });

  it("NO genera 'le chatelier' para una materia no relacionada", () => {
    const aliases = deriveAcademicAliases({
      title: "Revolucion Francesa",
      subject: "Historia",
      description: "Causas y consecuencias del periodo revolucionario.",
      chunkTerms: ["antiguo regimen", "asamblea nacional", "monarquia"],
    });
    expect(aliases).not.toContain("le chatelier");
    expect(aliases).toEqual([]);
  });

  it("NO genera 'le chatelier' para programación / sistemas operativos", () => {
    const aliases = deriveAcademicAliases({
      title: "Sistemas operativos",
      subject: "Informatica",
      description: "procesos, memoria virtual, scheduling y concurrencia",
      chunkTerms: ["planificacion de procesos", "memoria", "semaforo"],
    });
    expect(aliases).toEqual([]);
  });

  it("NO genera alias por una sola señal aislada", () => {
    // Solo "equilibrio" (la ancla) sin más señales fuertes: no alcanza el umbral.
    const aliases = deriveAcademicAliases({
      title: null,
      subject: null,
      description: null,
      chunkTerms: ["equilibrio"],
    });
    expect(aliases).toEqual([]);
  });

  it("NO genera alias con señales sueltas sin la ancla de equilibrio", () => {
    // Temperatura + presión + concentración (termodinámica de gases) pero sin
    // equilibrio ni el nombre: no es Le Chatelier.
    const aliases = deriveAcademicAliases({
      title: "Gases ideales",
      subject: "Fisica",
      description: null,
      chunkTerms: ["temperatura", "presion", "concentracion"],
    });
    expect(aliases).toEqual([]);
  });

  it("NO genera 'le chatelier' en Física: equilibrio térmico + temperatura + presión (sin señal específica)", () => {
    // Tiene la ancla (equilibri) y 3 categorías compartidas, pero NINGUNA señal
    // específica de química → no debe disparar. Este es el falso positivo que
    // el parche elimina.
    const aliases = deriveAcademicAliases({
      title: "Equilibrio termico",
      subject: "Fisica",
      description: "temperatura y presion de un sistema termodinamico",
      chunkTerms: ["equilibrio termico", "temperatura", "presion"],
    });
    expect(aliases).not.toContain("le chatelier");
    expect(aliases).toEqual([]);
  });

  it("NO genera 'le chatelier' en gases ideales con equilibrio + temperatura + presión (sin señal específica)", () => {
    const aliases = deriveAcademicAliases({
      title: "Gases ideales",
      subject: "Fisica",
      description: "el sistema alcanza el equilibrio; presion, temperatura, volumen",
      chunkTerms: ["equilibrio", "temperatura", "presion", "volumen"],
    });
    expect(aliases).not.toContain("le chatelier");
    expect(aliases).toEqual([]);
  });

  it("NO genera 'le chatelier' en economía: equilibrio de mercado", () => {
    const aliases = deriveAcademicAliases({
      title: "Equilibrio de mercado",
      subject: "Economia",
      description: "precio y cantidad de equilibrio, oferta y demanda",
      chunkTerms: ["equilibrio de mercado", "oferta", "demanda"],
    });
    expect(aliases).not.toContain("le chatelier");
    expect(aliases).toEqual([]);
  });

  it("NO genera 'le chatelier' en química general SIN equilibrio", () => {
    // Falta la ancla "equilibri": aunque sea química, no es Le Chatelier.
    const aliases = deriveAcademicAliases({
      title: "Introduccion a la quimica",
      subject: "Quimica",
      description: "tabla periodica, enlaces, estequiometria y concentracion",
      chunkTerms: ["tabla periodica", "enlace covalente", "concentracion"],
    });
    expect(aliases).not.toContain("le chatelier");
    expect(aliases).toEqual([]);
  });

  it("deduplica los aliases (no repite si la señal aparece muchas veces)", () => {
    const aliases = deriveAcademicAliases({
      title: "Equilibrio quimico equilibrio quimico",
      subject: "Quimica",
      description: "concentracion temperatura presion perturbacion",
      chunkTerms: equilibrioChunkTerms,
    });
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it("no supera los límites de cantidad ni de largo", () => {
    const aliases = deriveAcademicAliases({
      title: "Equilibrio Quimico",
      subject: "Quimica",
      description: null,
      chunkTerms: equilibrioChunkTerms,
    });
    expect(aliases.length).toBeLessThanOrEqual(MAX_ACADEMIC_ALIASES);
    for (const alias of aliases) {
      expect(alias.length).toBeLessThanOrEqual(MAX_CHUNK_TERM_LENGTH);
    }
  });

  it("normaliza acentos: 'Le Châtelier' queda como 'le chatelier'", () => {
    const aliases = deriveAcademicAliases({
      title: "Le Châtelier",
      subject: "Química",
      description: "Perturbación del equilibrio químico y concentración.",
      chunkTerms: [],
    });
    expect(aliases).toContain("le chatelier");
    // Sin acentos en ningún alias.
    expect(
      aliases.every(
        (a) => a === a.normalize("NFD").replace(/[̀-ͯ]/g, "")
      )
    ).toBe(true);
  });

  it("es robusto ante entradas vacías", () => {
    expect(
      deriveAcademicAliases({
        title: null,
        subject: null,
        description: null,
        chunkTerms: [],
      })
    ).toEqual([]);
  });
});

describe("normalizeSectionTitles", () => {
  it("trimea, colapsa espacios y preserva mayúsculas/acentos", () => {
    expect(
      normalizeSectionTitles(["  Equilibrio   químico  "])
    ).toEqual(["Equilibrio químico"]);
  });

  it("deduplica case/acento-insensitive conservando la primera forma legible", () => {
    expect(
      normalizeSectionTitles([
        "Equilibrio Químico",
        "equilibrio quimico",
        "EQUILIBRIO QUÍMICO",
      ])
    ).toEqual(["Equilibrio Químico"]);
  });

  it("descarta headings genéricos/numéricos sin token de contenido", () => {
    expect(
      normalizeSectionTitles([
        "Introducción",
        "Unidad 1",
        "Tema 2",
        "Constante de equilibrio",
      ])
    ).toEqual(["Constante de equilibrio"]);
  });

  it("ignora entradas no string, vacías o demasiado largas", () => {
    expect(
      normalizeSectionTitles([
        null,
        undefined,
        "   ",
        "x".repeat(MAX_SECTION_TITLE_LENGTH + 1),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        123 as any,
        "Reacciones reversibles",
      ])
    ).toEqual(["Reacciones reversibles"]);
  });

  it("acota la cantidad a MAX_SECTION_TITLES", () => {
    const titles = Array.from(
      { length: MAX_SECTION_TITLES + 10 },
      (_, i) => `Seccion contenido ${i}`
    );
    expect(normalizeSectionTitles(titles)).toHaveLength(MAX_SECTION_TITLES);
  });

  it("es robusto ante entradas vacías", () => {
    expect(normalizeSectionTitles([])).toEqual([]);
  });
});
