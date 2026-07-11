import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveSellerProvider,
  sellerAcceptsPayments,
} from "../resolve-provider";

/**
 * Mock mínimo del admin client: enruta por nombre de tabla y devuelve la fila
 * configurada para cada una vía .select().eq().maybeSingle().
 */
function mockAdmin(dataByTable: Record<string, unknown>): SupabaseClient {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: dataByTable[table] ?? null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const PAYPAL_ROW = {
  paypal_merchant_id: "M123",
  payout_currency: "MXN",
  payments_receivable: true,
};

describe("resolveSellerProvider", () => {
  it("dado solo MP conectado, entonces provider = mercadopago", async () => {
    const admin = mockAdmin({ seller_mp_credentials: { id: "s1" } });
    const res = await resolveSellerProvider(admin, "s1");
    expect(res.provider).toBe("mercadopago");
    expect(res.paypal).toBeNull();
  });

  it("dado solo PayPal conectado, entonces provider = paypal con sus credenciales", async () => {
    const admin = mockAdmin({ seller_paypal_credentials: PAYPAL_ROW });
    const res = await resolveSellerProvider(admin, "s1");
    expect(res.provider).toBe("paypal");
    expect(res.paypal).toEqual({
      merchantId: "M123",
      currency: "MXN",
      paymentsReceivable: true,
    });
  });

  it("dado ambos conectados sin preferencia, entonces default mercadopago", async () => {
    const admin = mockAdmin({
      seller_mp_credentials: { id: "s1" },
      seller_paypal_credentials: PAYPAL_ROW,
      profiles: { preferred_payment_provider: null },
    });
    const res = await resolveSellerProvider(admin, "s1");
    expect(res.provider).toBe("mercadopago");
  });

  it("dado ambos conectados con preferencia paypal, entonces provider = paypal", async () => {
    const admin = mockAdmin({
      seller_mp_credentials: { id: "s1" },
      seller_paypal_credentials: PAYPAL_ROW,
      profiles: { preferred_payment_provider: "paypal" },
    });
    const res = await resolveSellerProvider(admin, "s1");
    expect(res.provider).toBe("paypal");
    expect(res.paypal?.merchantId).toBe("M123");
  });

  it("dado ninguno conectado, entonces provider = null", async () => {
    const admin = mockAdmin({});
    const res = await resolveSellerProvider(admin, "s1");
    expect(res.provider).toBeNull();
    expect(res.paypal).toBeNull();
  });
});

describe("sellerAcceptsPayments", () => {
  it("true si tiene MP", async () => {
    const admin = mockAdmin({ seller_mp_credentials: { id: "s1" } });
    expect(await sellerAcceptsPayments(admin, "s1")).toBe(true);
  });

  it("true si tiene PayPal", async () => {
    const admin = mockAdmin({ seller_paypal_credentials: { id: "s1" } });
    expect(await sellerAcceptsPayments(admin, "s1")).toBe(true);
  });

  it("false si no tiene ninguno", async () => {
    const admin = mockAdmin({});
    expect(await sellerAcceptsPayments(admin, "s1")).toBe(false);
  });
});
