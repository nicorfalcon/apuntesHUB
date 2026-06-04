// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResumeCard } from "../resume-card";
import type { ResumeWithSeller } from "@/lib/database.types";

// next/image necesita mock para tests: el runtime real intenta optimizar la
// imagen contra el servidor de Next, lo que no aplica en jsdom. Reemplazamos
// con un <img> simple que respeta src y alt.
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    className?: string;
  }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img src={src} alt={alt} />;
  },
}));

function makeResume(overrides: Partial<ResumeWithSeller> = {}): ResumeWithSeller {
  return {
    id: "r-1",
    title: "Resumen Análisis I",
    subject: "Análisis I",
    university: "ITBA",
    career: "Bioing",
    price: 2500,
    file_url: "x.pdf",
    preview_url: null,
    description: null,
    status: "published",
    seller_id: "s-1",
    rating_avg: 4.5,
    rating_count: 12,
    topics: [],
    deleted_at: null,
    created_at: "2026-05-01",
    updated_at: "2026-05-01",
    profiles: {
      display_name: "Juan Pérez",
      avatar_url: null,
      seller_rating_avg: 4.5,
      seller_rating_count: 30,
    },
    ...overrides,
  } as ResumeWithSeller;
}

describe("ResumeCard", () => {
  it("dado un resume publicado, entonces renderiza título, vendedor y precio formateado en ARS", () => {
    render(<ResumeCard resume={makeResume()} />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Resumen Análisis I" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Juan Pérez/)).toBeInTheDocument();
    expect(screen.getByText(/\$2\.500 ARS/)).toBeInTheDocument();
  });

  it("dado universidad y materia, entonces aparecen como metadata en el card", () => {
    render(<ResumeCard resume={makeResume()} />);

    expect(screen.getByText("ITBA")).toBeInTheDocument();
    expect(screen.getByText("Análisis I")).toBeInTheDocument();
  });

  it("dado purchased=true, entonces muestra el badge 'Comprado'", () => {
    render(<ResumeCard resume={makeResume()} purchased />);

    expect(screen.getByText("Comprado")).toBeInTheDocument();
  });

  it("dado purchased=false (default), entonces no muestra el badge 'Comprado'", () => {
    render(<ResumeCard resume={makeResume()} />);

    expect(screen.queryByText("Comprado")).not.toBeInTheDocument();
  });

  it("dado el card, entonces es un link a /resume/<id>", () => {
    render(<ResumeCard resume={makeResume({ id: "r-42" })} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/resume/r-42");
  });

  it("dado un resume con preview_url, entonces renderiza la imagen con el title como alt", () => {
    render(
      <ResumeCard
        resume={makeResume({ preview_url: "https://cdn.test/x.png" })}
      />
    );

    const img = screen.getByAltText("Resumen Análisis I");
    expect(img).toHaveAttribute("src", "https://cdn.test/x.png");
  });

  it("dado un resume con topics, entonces muestra hasta 3 chips y el excedente", () => {
    render(
      <ResumeCard
        resume={makeResume({
          topics: [
            "Le Chatelier",
            "Equilibrio químico",
            "Concentración",
            "Presión",
          ],
        })}
      />
    );

    expect(screen.getByText("Le Chatelier")).toBeInTheDocument();
    expect(screen.getByText("Equilibrio químico")).toBeInTheDocument();
    expect(screen.getByText("Concentración")).toBeInTheDocument();
    expect(screen.queryByText("Presión")).not.toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("dado topics vacío, entonces no muestra chips de temas", () => {
    render(<ResumeCard resume={makeResume({ topics: [] })} />);

    expect(screen.queryByText("Le Chatelier")).not.toBeInTheDocument();
    expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();
  });
});
