import { describe, expect, it } from "vitest";
import {
  clampDiscountPercent,
  discountSavings,
  discountedPrice,
  formatDiscountBadge,
  hasDiscount,
} from "../direct";

describe("discounts/direct", () => {
  it("clamps percent to 0–90 integers", () => {
    expect(clampDiscountPercent(-5)).toBe(0);
    expect(clampDiscountPercent(120)).toBe(90);
    expect(clampDiscountPercent(19.6)).toBe(20);
    expect(clampDiscountPercent(null)).toBe(0);
    expect(clampDiscountPercent(undefined)).toBe(0);
  });

  it("returns list price when there is no discount", () => {
    expect(discountedPrice(1000, 0)).toBe(1000);
    expect(discountedPrice(1000, null)).toBe(1000);
    expect(hasDiscount(0)).toBe(false);
  });

  it("applies percentage matching the SQL round(price*(100-pct)/100, 2)", () => {
    expect(discountedPrice(1000, 20)).toBe(800);
    expect(discountedPrice(1500, 10)).toBe(1350);
    expect(discountedPrice(999, 33)).toBe(669.33);
    expect(discountSavings(1000, 20)).toBe(200);
    expect(hasDiscount(20)).toBe(true);
  });

  it("caps discount at 90%", () => {
    expect(discountedPrice(1000, 95)).toBe(100);
  });

  it("formats a badge label", () => {
    expect(formatDiscountBadge(20)).toBe("-20%");
    expect(formatDiscountBadge(0)).toBe("-0%");
  });
});
