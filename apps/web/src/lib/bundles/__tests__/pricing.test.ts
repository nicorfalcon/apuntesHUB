import { describe, it, expect } from "vitest";
import {
  sumResumePrices,
  bundleSavings,
  bundleSavingsPercent,
  validateBundleForm,
} from "../pricing";

describe("sumResumePrices", () => {
  it("suma precios válidos", () => {
    expect(sumResumePrices([100, 200, 50])).toBe(350);
  });
  it("ignora precios inválidos o negativos", () => {
    expect(sumResumePrices([100, NaN, -20, 0])).toBe(100);
  });
  it("vacío da 0", () => {
    expect(sumResumePrices([])).toBe(0);
  });
});

describe("bundleSavings", () => {
  it("calcula el ahorro absoluto", () => {
    expect(bundleSavings(800, 1000)).toBe(200);
  });
  it("no es negativo si el pack cuesta más que la suma", () => {
    expect(bundleSavings(1200, 1000)).toBe(0);
  });
});

describe("bundleSavingsPercent", () => {
  it("calcula el porcentaje de ahorro", () => {
    expect(bundleSavingsPercent(800, 1000)).toBe(20);
    expect(bundleSavingsPercent(750, 1000)).toBe(25);
  });
  it("0 si no hay base de comparación", () => {
    expect(bundleSavingsPercent(500, 0)).toBe(0);
  });
});

describe("validateBundleForm", () => {
  const base = { title: "Pack", price: 1000, resumeIds: ["a", "b"] };

  it("acepta un pack válido", () => {
    expect(validateBundleForm(base)).toBeNull();
  });
  it("exige título", () => {
    expect(validateBundleForm({ ...base, title: "  " })).toMatch(/título/i);
  });
  it("exige precio válido", () => {
    expect(validateBundleForm({ ...base, price: -5 })).toMatch(/precio/i);
    expect(validateBundleForm({ ...base, price: NaN })).toMatch(/precio/i);
  });
  it("exige al menos 2 apuntes", () => {
    expect(validateBundleForm({ ...base, resumeIds: ["a"] })).toMatch(/2 apuntes/i);
    expect(validateBundleForm({ ...base, resumeIds: [] })).toMatch(/2 apuntes/i);
  });
});
