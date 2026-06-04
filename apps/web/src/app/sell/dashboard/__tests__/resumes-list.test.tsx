// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResumesList } from "../resumes-list";
import type { Resume } from "@/lib/database.types";

// next/image y next/link: reemplazos simples para jsdom.
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
// El menú de acciones usa el cliente de Supabase; lo reemplazamos por un stub.
vi.mock("../resume-actions-menu", () => ({
  ResumeActionsMenu: () => <div data-testid="actions-menu" />,
}));

function makeResume(overrides: Partial<Resume> = {}): Resume {
  return {
    id: "r-1",
    title: "Resumen Análisis I",
    subject: "Análisis I",
    university: "ITBA",
    status: "published",
    preview_url: null,
    price: 2500,
    rating_avg: null,
    rating_count: 0,
    ...overrides,
  } as Resume;
}

function renderList(
  statuses: Record<string, "pending" | "processing" | "done" | "failed">,
  errors: Record<string, { code: string | null; retryable: boolean | null }> = {}
) {
  return render(
    <ResumesList
      resumes={[makeResume()]}
      ventasPorResume={{}}
      ingresosPorResume={{}}
      ingestionStatuses={statuses}
      ingestionErrors={errors}
    />
  );
}

describe("ResumesList — diagnóstico de errores IA", () => {
  it("muestra mensaje específico para rate limit de Cohere", () => {
    renderList({ "r-1": "failed" }, { "r-1": { code: "COHERE_RATE_LIMIT", retryable: true } });
    expect(screen.getByText(/demasiadas solicitudes/i)).toBeInTheDocument();
    expect(screen.getByText("IA error")).toBeInTheDocument();
  });

  it("muestra mensaje específico para PDF sin texto", () => {
    renderList({ "r-1": "failed" }, { "r-1": { code: "PDF_NO_TEXT", retryable: false } });
    expect(screen.getByText(/no pudimos leer texto del pdf/i)).toBeInTheDocument();
    // retryable=false agrega la aclaración.
    expect(screen.getByText(/no reintentable/i)).toBeInTheDocument();
  });

  it("usa mensaje genérico cuando no hay código de error", () => {
    renderList({ "r-1": "failed" }, {});
    expect(screen.getByText(/error inesperado procesando la ia/i)).toBeInTheDocument();
  });

  it("no muestra mensaje de error si la ingesta fue exitosa", () => {
    renderList({ "r-1": "done" }, {});
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    expect(screen.getByText("IA ✓")).toBeInTheDocument();
  });
});
