import { describe, it, expect } from "vitest";
import {
  computeDiscount,
  finalPrice,
  normalizeCode,
  validateCouponForm,
  formatDiscountLabel,
} from "../discount";

describe("computeDiscount", () => {
  it("calcula porcentaje", () => {
    expect(computeDiscount(1000, { discountType: "percentage", value: 20 })).toBe(200);
    expect(computeDiscount(999, { discountType: "percentage", value: 10 })).toBe(99.9);
  });

  it("calcula monto fijo", () => {
    expect(computeDiscount(1000, { discountType: "fixed", value: 500 })).toBe(500);
  });

  it("nunca descuenta más que el precio", () => {
    expect(computeDiscount(300, { discountType: "fixed", value: 500 })).toBe(300);
    expect(computeDiscount(300, { discountType: "percentage", value: 100 })).toBe(300);
  });

  it("devuelve 0 para precios inválidos", () => {
    expect(computeDiscount(0, { discountType: "percentage", value: 20 })).toBe(0);
    expect(computeDiscount(-5, { discountType: "fixed", value: 10 })).toBe(0);
  });
});

describe("finalPrice", () => {
  it("resta el descuento del precio", () => {
    expect(finalPrice(1000, { discountType: "percentage", value: 20 })).toBe(800);
    expect(finalPrice(1000, { discountType: "fixed", value: 500 })).toBe(500);
  });

  it("no baja de 0", () => {
    expect(finalPrice(300, { discountType: "fixed", value: 500 })).toBe(0);
  });
});

describe("normalizeCode", () => {
  it("pasa a mayúsculas y recorta espacios", () => {
    expect(normalizeCode("  parcial20 ")).toBe("PARCIAL20");
  });
});

describe("validateCouponForm", () => {
  const base = { code: "PARCIAL20", discountType: "percentage" as const, value: 20, maxUses: null };

  it("acepta un cupón válido", () => {
    expect(validateCouponForm(base)).toBeNull();
  });

  it("rechaza códigos con formato inválido", () => {
    expect(validateCouponForm({ ...base, code: "ab" })).toMatch(/código/i);
    expect(validateCouponForm({ ...base, code: "CON ESPACIO" })).toMatch(/código/i);
  });

  it("rechaza valor <= 0", () => {
    expect(validateCouponForm({ ...base, value: 0 })).toMatch(/mayor a 0/i);
  });

  it("rechaza porcentaje > 100", () => {
    expect(validateCouponForm({ ...base, value: 150 })).toMatch(/100/);
  });

  it("permite monto fijo > 100", () => {
    expect(
      validateCouponForm({ ...base, discountType: "fixed", value: 500 })
    ).toBeNull();
  });

  it("rechaza límite de usos inválido", () => {
    expect(validateCouponForm({ ...base, maxUses: 0 })).toMatch(/límite/i);
    expect(validateCouponForm({ ...base, maxUses: 2.5 })).toMatch(/límite/i);
  });
});

describe("formatDiscountLabel", () => {
  it("formatea porcentaje y monto fijo", () => {
    expect(formatDiscountLabel({ discountType: "percentage", value: 20 })).toBe("20% OFF");
    expect(formatDiscountLabel({ discountType: "fixed", value: 500 })).toBe("$500 OFF");
  });
});
