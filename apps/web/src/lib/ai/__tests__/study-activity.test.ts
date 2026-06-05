import { describe, expect, it } from "vitest";
import { extractJsonObject, parseStudyActivity } from "../study-activity";

const VALID_MC = {
  type: "multiple_choice",
  title: "Equilibrio químico",
  questions: [
    {
      id: "q1",
      question: "¿Qué perturbación aparece en el apunte?",
      options: ["Temperatura", "Fotosíntesis", "Mitología", "Ortografía"],
      correctOptionIndex: 0,
      explanation: "El contexto menciona temperatura.",
    },
  ],
};

describe("parseStudyActivity", () => {
  it("parsea y limita una actividad de verdadero/falso válida", () => {
    const activity = parseStudyActivity(
      JSON.stringify({
        type: "true_false",
        title: "Le Chatelier",
        questions: [
          {
            id: "q1",
            statement: "El equilibrio puede desplazarse ante cambios de temperatura.",
            answer: true,
            explanation: "El fragmento menciona perturbaciones de temperatura.",
            sourceLabel: "pág. 1-2",
          },
          {
            id: "q2",
            statement: "Una perturbación nunca cambia el equilibrio.",
            answer: false,
            explanation: "El contexto indica que el sistema responde al cambio.",
          },
          {
            id: "q3",
            statement: "La concentración puede afectar el equilibrio.",
            answer: true,
            explanation: "Aparece como una perturbación posible.",
          },
          {
            id: "q4",
            statement: "Esta pregunta excede el máximo.",
            answer: true,
            explanation: "No debería quedar.",
          },
        ],
      }),
      "true_false"
    );

    expect(activity).toMatchObject({
      type: "true_false",
      title: "Le Chatelier",
    });
    expect(activity?.questions).toHaveLength(3);
    expect(activity?.questions[0]).toMatchObject({
      id: "q1",
      answer: true,
      sourceLabel: "pág. 1-2",
    });
  });

  it("parsea multiple choice válido y exige cuatro opciones", () => {
    const activity = parseStudyActivity(
      JSON.stringify({
        type: "multiple_choice",
        title: "Equilibrio químico",
        questions: [
          {
            id: "q1",
            question: "¿Qué perturbación aparece en el apunte?",
            options: ["Temperatura", "Fotosíntesis", "Mitología", "Ortografía"],
            correctOptionIndex: 0,
            explanation: "El contexto menciona temperatura.",
          },
        ],
      }),
      "multiple_choice"
    );

    expect(activity).toMatchObject({
      type: "multiple_choice",
      questions: [
        expect.objectContaining({
          correctOptionIndex: 0,
          options: ["Temperatura", "Fotosíntesis", "Mitología", "Ortografía"],
        }),
      ],
    });
  });

  it("rechaza JSON inválido o actividad del modo equivocado", () => {
    expect(parseStudyActivity("{mal json", "true_false")).toBeNull();
    expect(
      parseStudyActivity(
        JSON.stringify({ type: "true_false", title: "x", questions: [] }),
        "multiple_choice"
      )
    ).toBeNull();
  });

  it("parsea JSON envuelto en un bloque markdown ```json", () => {
    const raw = "```json\n" + JSON.stringify(VALID_MC) + "\n```";
    const activity = parseStudyActivity(raw, "multiple_choice");
    expect(activity).toMatchObject({ type: "multiple_choice" });
    expect(activity?.questions).toHaveLength(1);
  });

  it("parsea JSON con texto antes y después (modelo charlatán)", () => {
    const raw =
      "¡Claro! Acá tenés la actividad:\n" +
      JSON.stringify(VALID_MC) +
      '\nFUENTES_JSON:[{"type":"note","label":"Tu apunte"}]';
    const activity = parseStudyActivity(raw, "multiple_choice");
    expect(activity).toMatchObject({ type: "multiple_choice" });
  });

  it("rechaza multiple choice con menos de 4 opciones", () => {
    const activity = parseStudyActivity(
      JSON.stringify({
        ...VALID_MC,
        questions: [{ ...VALID_MC.questions[0], options: ["A", "B", "C"] }],
      }),
      "multiple_choice"
    );
    expect(activity).toBeNull();
  });

  it("rechaza multiple choice con correctOptionIndex fuera de rango", () => {
    const activity = parseStudyActivity(
      JSON.stringify({
        ...VALID_MC,
        questions: [{ ...VALID_MC.questions[0], correctOptionIndex: 7 }],
      }),
      "multiple_choice"
    );
    expect(activity).toBeNull();
  });

  it("rechaza verdadero/falso cuando answer no es booleano", () => {
    const activity = parseStudyActivity(
      JSON.stringify({
        type: "true_false",
        title: "x",
        questions: [
          {
            id: "q1",
            statement: "Afirmación",
            answer: "sí",
            explanation: "porque sí",
          },
        ],
      }),
      "true_false"
    );
    expect(activity).toBeNull();
  });
});

describe("extractJsonObject", () => {
  it("devuelve el JSON puro sin cambios", () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it("recorta texto antes y después del objeto", () => {
    expect(extractJsonObject('texto {"a":1} más texto')).toBe('{"a":1}');
  });

  it("respeta llaves dentro de strings", () => {
    const json = '{"a":"con } llave","b":2}';
    expect(extractJsonObject(`prefijo ${json}`)).toBe(json);
  });

  it("devuelve null cuando no hay objeto cerrado", () => {
    expect(extractJsonObject("sin json acá")).toBeNull();
    expect(extractJsonObject('{"a": 1')).toBeNull();
  });
});
