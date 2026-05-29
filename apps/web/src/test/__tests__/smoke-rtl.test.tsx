// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// Smoke test del setup de Vitest + jsdom + Testing Library. Si este test pasa,
// el pipeline para testear componentes React está listo. No prueba lógica de
// la app: solo confirma que rendering, queries y eventos funcionan.

function Contador() {
  const [n, setN] = useState(0);
  return (
    <div>
      <p>Cuenta: {n}</p>
      <button onClick={() => setN((v) => v + 1)}>Sumar</button>
    </div>
  );
}

describe("smoke: Vitest + jsdom + RTL", () => {
  it("renderiza un componente y refleja su estado inicial", () => {
    // when
    render(<Contador />);

    // then
    expect(screen.getByText("Cuenta: 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sumar" })).toBeVisible();
  });

  it("actualiza el estado cuando el usuario hace clic", async () => {
    // given
    const user = userEvent.setup();
    render(<Contador />);

    // when
    await user.click(screen.getByRole("button", { name: "Sumar" }));

    // then
    expect(screen.getByText("Cuenta: 1")).toBeInTheDocument();
  });
});
