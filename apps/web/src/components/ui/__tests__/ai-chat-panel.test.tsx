// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiChatPanel } from "../ai-chat-panel";

const h = vi.hoisted(() => ({
  setSelectedModel: vi.fn(),
  goToAddKey: vi.fn(),
}));

vi.mock("@/hooks/use-ai-models", () => ({
  useAIModels: () => ({
    models: [{ id: "platform", name: "apuntesHUB", hasWebSearch: false }],
    selectedModel: { id: "platform", name: "apuntesHUB", hasWebSearch: false },
    setSelectedModel: h.setSelectedModel,
    loading: false,
    goToAddKey: h.goToAddKey,
  }),
}));

vi.mock("../model-selector", () => ({
  ModelSelector: () => <div data-testid="model-selector" />,
}));

async function openPanel() {
  render(<AiChatPanel resumeId="r1" resumeTitle="Equilibrio Químico" aiReady />);
  await userEvent.click(screen.getByRole("button", { name: /abrir asistente ia/i }));
}

describe("AiChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("muestra los tabs Chat y Estudiar, con Chat activo por defecto", async () => {
    await openPanel();

    expect(screen.getByRole("tab", { name: /chat/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /estudiar/i })).toHaveAttribute("aria-selected", "false");
  });

  it("expone la semántica ARIA completa de tabs/tabpanel", async () => {
    await openPanel();

    const chatTab = screen.getByRole("tab", { name: /chat/i });
    const studyTab = screen.getByRole("tab", { name: /estudiar/i });
    expect(chatTab).toHaveAttribute("id", "ai-chat-tab-chat");
    expect(chatTab).toHaveAttribute("aria-controls", "ai-chat-panel-chat");
    expect(studyTab).toHaveAttribute("aria-controls", "ai-chat-panel-study");

    // Roving tabindex: solo el tab activo es tabbable.
    expect(chatTab).toHaveAttribute("tabindex", "0");
    expect(studyTab).toHaveAttribute("tabindex", "-1");

    // El panel activo es un tabpanel etiquetado por el tab activo.
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "ai-chat-panel-chat");
    expect(panel).toHaveAttribute("aria-labelledby", "ai-chat-tab-chat");
  });

  it("al activar Estudiar, el tabpanel queda etiquetado por el tab de estudio", async () => {
    await openPanel();
    await userEvent.click(screen.getByRole("tab", { name: /estudiar/i }));

    expect(screen.getByRole("tab", { name: /estudiar/i })).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "ai-chat-panel-study");
    expect(panel).toHaveAttribute("aria-labelledby", "ai-chat-tab-study");
    // El setup de práctica sigue mostrándose.
    expect(screen.getByRole("button", { name: /generar práctica/i })).toBeInTheDocument();
  });

  it("navega entre tabs con flechas, Home y End", async () => {
    await openPanel();
    const chatTab = screen.getByRole("tab", { name: /chat/i });
    const studyTab = screen.getByRole("tab", { name: /estudiar/i });

    chatTab.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(studyTab).toHaveAttribute("aria-selected", "true");
    expect(studyTab).toHaveFocus();

    await userEvent.keyboard("{ArrowLeft}");
    expect(chatTab).toHaveAttribute("aria-selected", "true");
    expect(chatTab).toHaveFocus();

    await userEvent.keyboard("{End}");
    expect(studyTab).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Home}");
    expect(chatTab).toHaveAttribute("aria-selected", "true");
  });

  it("el selector de modo del chat ya no ofrece actividades estructuradas", async () => {
    await openPanel();
    await userEvent.click(screen.getByRole("button", { name: /modo de respuesta: auto/i }));

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Explicar/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Paso a paso/ })).toBeInTheDocument();
    // Las actividades estructuradas se movieron a la pestaña Estudiar.
    expect(screen.queryByRole("option", { name: /Multiple choice/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /V\/F/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Quiz/ })).not.toBeInTheDocument();
  });

  it("default Auto: el chat normal funciona y manda answerMode auto", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: "La recursión es…", sources: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await openPanel();
    await userEvent.type(
      screen.getByPlaceholderText(/preguntá sobre este apunte/i),
      "qué es la recursión"
    );
    await userEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.answerMode).toBe("auto");
    expect(await screen.findByText("La recursión es…")).toBeInTheDocument();
  });

  it("permite cambiar el modo conversacional y enviarlo en el payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: "ok", sources: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await openPanel();
    await userEvent.click(screen.getByRole("button", { name: /modo de respuesta: auto/i }));
    await userEvent.click(screen.getByRole("option", { name: /Explicar/ }));
    await userEvent.type(
      screen.getByPlaceholderText(/preguntá sobre este apunte/i),
      "explicame esto"
    );
    await userEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.answerMode).toBe("explain");
  });

  it("abre la pestaña Estudiar y muestra el setup de práctica", async () => {
    await openPanel();
    await userEvent.click(screen.getByRole("tab", { name: /estudiar/i }));

    expect(screen.getByRole("button", { name: /generar práctica/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /multiple choice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verdadero \/ falso/i })).toBeInTheDocument();
    // El hilo del chat (input) ya no se muestra en la pestaña de estudio.
    expect(screen.queryByPlaceholderText(/preguntá sobre este apunte/i)).not.toBeInTheDocument();
  });

  it("'Practicar este tema' abre Estudiar con el tema prellenado", async () => {
    await openPanel();
    await userEvent.type(
      screen.getByPlaceholderText(/preguntá sobre este apunte/i),
      "Le Chatelier"
    );
    await userEvent.click(screen.getByRole("button", { name: /practicar este tema/i }));

    expect(screen.getByRole("button", { name: /generar práctica/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/tema/i)).toHaveValue("Le Chatelier");
  });
});
