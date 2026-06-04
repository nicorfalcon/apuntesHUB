// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import {
  ResumeTopicChips,
  ResumeTopicsSection,
  getDisplayResumeTopics,
} from "../resume-topics";

describe("ResumeTopicsSection", () => {
  it("muestra los temas del apunte si hay valores", () => {
    render(
      <ResumeTopicsSection
        topics={["Le Chatelier", "Equilibrio químico", "Concentración"]}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Temas del apunte" })
    ).toBeInTheDocument();
    expect(screen.getByText("Le Chatelier")).toBeInTheDocument();
    expect(screen.getByText("Equilibrio químico")).toBeInTheDocument();
    expect(screen.getByText("Concentración")).toBeInTheDocument();
  });

  it("no muestra la sección si topics está vacío", () => {
    const { container } = render(<ResumeTopicsSection topics={[]} />);

    expect(screen.queryByText("Temas del apunte")).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it("no rompe ni muestra la sección si topics viene null", () => {
    const { container } = render(<ResumeTopicsSection topics={null} />);

    expect(screen.queryByText("Temas del apunte")).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it("preserva el orden cargado por el vendedor", () => {
    const topics = getDisplayResumeTopics([
      "Le Chatelier",
      "Equilibrio químico",
      "Concentración",
      "Presión",
    ]);

    expect(topics).toEqual([
      "Le Chatelier",
      "Equilibrio químico",
      "Concentración",
      "Presión",
    ]);
  });
});

describe("ResumeTopicChips", () => {
  it("limpia textos vacíos y etiquetas HTML antes de mostrar", () => {
    render(
      <ResumeTopicChips
        topics={["  Le   Chatelier  ", "", "<strong>Presión</strong>"]}
      />
    );

    expect(screen.getByText("Le Chatelier")).toBeInTheDocument();
    expect(screen.getByText("Presión")).toBeInTheDocument();
    expect(screen.queryByText(/strong/)).not.toBeInTheDocument();
  });

  it("en modo compacto muestra máximo 3 topics y el excedente como +N", () => {
    render(
      <ResumeTopicChips
        topics={[
          "Le Chatelier",
          "Equilibrio químico",
          "Concentración",
          "Presión",
          "Temperatura",
        ]}
        maxVisible={3}
      />
    );

    const list = screen.getByText("Le Chatelier").parentElement?.parentElement;
    expect(list).not.toBeNull();
    expect(
      within(list as HTMLElement).getByText("Equilibrio químico")
    ).toBeInTheDocument();
    expect(within(list as HTMLElement).getByText("Concentración")).toBeInTheDocument();
    expect(screen.queryByText("Presión")).not.toBeInTheDocument();
    expect(screen.queryByText("Temperatura")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});
