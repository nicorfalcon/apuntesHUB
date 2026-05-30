// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionCard } from "../session-card";
import type { ActiveSession } from "@/lib/database.types";

function makeSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    id: "sess-1",
    label: "Mac de casa",
    user_agent: "Mozilla/5.0 (Macintosh)",
    created_at: "2026-05-01T10:00:00Z",
    last_seen_at: "2026-05-29T10:00:00Z",
    is_current: false,
    ...overrides,
  } as ActiveSession;
}

describe("SessionCard — variante profile", () => {
  it("dado un device cualquiera, entonces muestra el label y el botón 'Revocar'", () => {
    render(
      <SessionCard
        session={makeSession({ label: "iPhone de Juan" })}
        variant="profile"
      />
    );

    expect(screen.getByText("iPhone de Juan")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Revocar/ })
    ).toBeInTheDocument();
  });

  it("dado el device actual, entonces muestra el badge 'Este dispositivo' y deshabilita Revocar", () => {
    render(
      <SessionCard
        session={makeSession({ is_current: true })}
        variant="profile"
      />
    );

    expect(screen.getByText("Este dispositivo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revocar/ })).toBeDisabled();
  });

  it("dado isLoading=true, entonces muestra 'Revocando...' y deshabilita el botón", () => {
    render(
      <SessionCard
        session={makeSession()}
        variant="profile"
        isLoading
      />
    );

    expect(screen.getByRole("button", { name: /Revocando/ })).toBeDisabled();
  });

  it("dado un click en Revocar, entonces dispara onAction", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <SessionCard
        session={makeSession()}
        variant="profile"
        onAction={onAction}
      />
    );

    await user.click(screen.getByRole("button", { name: /Revocar/ }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("dado un device sin label, entonces muestra 'Dispositivo desconocido'", () => {
    render(
      <SessionCard
        session={makeSession({ label: null as unknown as string })}
        variant="profile"
      />
    );
    expect(screen.getByText("Dispositivo desconocido")).toBeInTheDocument();
  });
});

describe("SessionCard — variante picker", () => {
  it("dado isRecommended=true, entonces muestra el badge 'Recomendado'", () => {
    render(
      <SessionCard
        session={makeSession()}
        variant="picker"
        isRecommended
      />
    );

    expect(screen.getByText(/Recomendado/)).toBeInTheDocument();
  });

  it("dado el modo picker, entonces el card entero es un botón con label 'Cerrar y continuar'", () => {
    const onAction = vi.fn();
    render(
      <SessionCard
        session={makeSession()}
        variant="picker"
        onAction={onAction}
      />
    );

    const btn = screen.getByRole("button", { name: /Cerrar y continuar/ });
    expect(btn).toBeInTheDocument();
  });

  it("dado isLoading=true en picker, entonces muestra 'Cerrando...' y queda deshabilitado", () => {
    render(
      <SessionCard
        session={makeSession()}
        variant="picker"
        isLoading
      />
    );

    const btn = screen.getByRole("button", { name: /Cerrando/ });
    expect(btn).toBeDisabled();
  });

  it("dado un click en el picker, entonces dispara onAction", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <SessionCard
        session={makeSession()}
        variant="picker"
        onAction={onAction}
      />
    );

    await user.click(screen.getByRole("button", { name: /Cerrar y continuar/ }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
