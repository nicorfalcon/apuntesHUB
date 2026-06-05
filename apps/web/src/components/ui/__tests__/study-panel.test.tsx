// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StudyPanel } from "../study-panel";

const MC_ACTIVITY = {
  type: "multiple_choice",
  title: "Kc y Kp",
  questions: [
    {
      id: "q1",
      question: "¿Qué es Kc?",
      options: ["Alfa", "Beta", "Gamma", "Delta"],
      correctOptionIndex: 0,
      explanation: "explicación uno",
      sourceLabel: "pág. 1",
    },
    {
      id: "q2",
      question: "¿Qué es Kp?",
      options: ["Uno", "Dos", "Tres", "Cuatro"],
      correctOptionIndex: 1,
      explanation: "explicación dos",
    },
  ],
};

const VF_ACTIVITY = {
  type: "true_false",
  title: "Le Chatelier",
  questions: [
    {
      id: "q1",
      statement: "El equilibrio responde a la temperatura.",
      answer: true,
      explanation: "el apunte lo menciona",
      sourceLabel: "pág. 2",
    },
  ],
};

function mockFetch(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => payload,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPanel(onBack = vi.fn()) {
  render(
    <StudyPanel
      resumeId="r1"
      resumeTitle="Equilibrio Químico"
      apiKeyId="platform"
      onBackToChat={onBack}
    />
  );
  return onBack;
}

describe("StudyPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("genera multiple choice, muestra progreso y feedback, avanza y llega a resultados", async () => {
    const fetchMock = mockFetch({
      answer: "Actividad lista para practicar.",
      sources: [{ type: "note", label: "Tu apunte" }],
      activity: MC_ACTIVITY,
    });
    const onBack = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /generar práctica/i }));

    // Pantalla de actividad: una pregunta por vez con progreso.
    expect(await screen.findByText("Pregunta 1 de 2")).toBeInTheDocument();
    expect(screen.getByText("¿Qué es Kc?")).toBeInTheDocument();

    // El payload usa el modo estructurado y la cantidad por defecto.
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.answerMode).toBe("multiple_choice");
    expect(payload.count).toBe(3);

    // Responder correcto → feedback + explicación.
    await userEvent.click(screen.getByRole("button", { name: "Alfa" }));
    expect(screen.getByText("Correcto")).toBeInTheDocument();
    expect(screen.getByText("explicación uno")).toBeInTheDocument();

    // Avanzar a la siguiente.
    await userEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(await screen.findByText("Pregunta 2 de 2")).toBeInTheDocument();

    // Responder incorrecto.
    await userEvent.click(screen.getByRole("button", { name: "Tres" }));
    expect(screen.getByText("Incorrecto")).toBeInTheDocument();

    // Ver resultados.
    await userEvent.click(screen.getByRole("button", { name: /ver resultados/i }));
    expect(await screen.findByText(/práctica completada/i)).toBeInTheDocument();
    expect(screen.getByText(/50% de aciertos/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /repetir incorrectas/i })).toBeInTheDocument();

    // Volver al chat dispara el callback.
    await userEvent.click(screen.getByRole("button", { name: /volver al chat/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("genera verdadero/falso y calcula el puntaje", async () => {
    mockFetch({
      answer: "Actividad lista para practicar.",
      sources: [],
      activity: VF_ACTIVITY,
    });
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /verdadero \/ falso/i }));
    await userEvent.click(screen.getByRole("button", { name: /generar práctica/i }));

    expect(await screen.findByText("Pregunta 1 de 1")).toBeInTheDocument();
    expect(screen.getByText(/responde a la temperatura/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Verdadero" }));
    expect(screen.getByText("Correcto")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /ver resultados/i }));
    expect(await screen.findByText(/100% de aciertos/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /repetir incorrectas/i })).not.toBeInTheDocument();
  });

  it("respeta la cantidad elegida (5) en el payload", async () => {
    const fetchMock = mockFetch({
      answer: "Actividad lista para practicar.",
      sources: [],
      activity: MC_ACTIVITY,
    });
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "5" }));
    await userEvent.click(screen.getByRole("button", { name: /generar práctica/i }));

    await screen.findByText("Pregunta 1 de 2");
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.count).toBe(5);
  });

  it("muestra un error en el setup si el backend no devuelve actividad", async () => {
    mockFetch({ answer: "texto plano sin actividad", sources: [] });
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /generar práctica/i }));

    expect(await screen.findByText(/no pude armar una práctica interactiva/i)).toBeInTheDocument();
    // Seguimos en el setup.
    expect(screen.getByRole("button", { name: /generar práctica/i })).toBeInTheDocument();
  });

  it("modo Quiz muestra preguntas abiertas en texto, sin tarjetas interactivas", async () => {
    mockFetch({
      answer: "1. ¿Qué representa Kc?\n2. ¿Diferencia entre Kc y Kp?",
      sources: [{ type: "note", label: "Tu apunte" }],
    });
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /quiz/i }));
    await userEvent.click(screen.getByRole("button", { name: /generar práctica/i }));

    expect(await screen.findByText(/preguntas para practicar/i)).toBeInTheDocument();
    expect(screen.getByText(/¿Diferencia entre Kc y Kp\?/i)).toBeInTheDocument();
  });
});
