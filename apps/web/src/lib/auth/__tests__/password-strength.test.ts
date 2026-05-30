import { describe, it, expect } from "vitest";
import { getPasswordStrength } from "../password-strength";

describe("getPasswordStrength", () => {
  it("dado una contraseña vacía, entonces devuelve score 0 sin label ni color", () => {
    expect(getPasswordStrength("")).toEqual({ score: 0, label: "", color: "" });
  });

  it("dado solo 5 caracteres (sin cumplir ningún criterio), entonces devuelve Débil", () => {
    const r = getPasswordStrength("abcde");
    expect(r.score).toBe(1);
    expect(r.label).toBe("Débil");
  });

  it("dado una contraseña con ≥6 caracteres todo minúsculas, entonces devuelve Débil", () => {
    const r = getPasswordStrength("abcdef");
    expect(r.score).toBe(1);
    expect(r.label).toBe("Débil");
  });

  it("dado ≥10 caracteres + un número (3 criterios), entonces devuelve Buena", () => {
    // length≥6 + length≥10 + número = 3 puntos
    const r = getPasswordStrength("abcdefghij1");
    expect(r.score).toBe(3);
    expect(r.label).toBe("Buena");
  });

  it("dado ≥10 caracteres + número + mayúscula (4 criterios), entonces devuelve Fuerte", () => {
    // length≥6 + length≥10 + A-Z + número = 4 puntos
    const r = getPasswordStrength("Abcdefghij1");
    expect(r.score).toBe(4);
    expect(r.label).toBe("Fuerte");
  });

  it("dado ≥6 caracteres + un número (2 criterios), entonces devuelve Regular", () => {
    const r = getPasswordStrength("abcde1");
    expect(r.score).toBe(2);
    expect(r.label).toBe("Regular");
  });

  it("dado una contraseña con todos los criterios cumplidos, entonces devuelve Fuerte", () => {
    const r = getPasswordStrength("Abcdefghij1!");
    expect(r.score).toBe(4);
    expect(r.label).toBe("Fuerte");
    expect(r.color).toBe("#2D6A4F");
  });

  it("dado una contraseña corta con símbolo y número, entonces devuelve Regular", () => {
    // length=6 + número + símbolo = 3 puntos → Buena
    const r = getPasswordStrength("ab1!cd");
    expect(r.label).toBe("Buena");
  });
});
