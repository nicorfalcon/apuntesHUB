import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("../client", () => ({
  paypalHeaders: async (extra: Record<string, string> = {}) => ({
    Authorization: "Bearer test",
    "Content-Type": "application/json",
    ...extra,
  }),
}));

vi.mock("../config", () => ({
  getPayPalApiBase: () => "https://api.test",
  getPartnerMerchantId: () => "PARTNER_MID",
}));

vi.mock("../auth-assertion", () => ({
  buildAuthAssertion: (mid: string) => `assert-${mid}`,
}));

import { createPayPalOrder } from "../create-order";

beforeEach(() => {
  h.fetch.mockReset();
  vi.stubGlobal("fetch", h.fetch);
});

function okResponse() {
  return {
    ok: true,
    json: async () => ({
      id: "ORDER_1",
      links: [
        { rel: "self", href: "https://api.test/v2/checkout/orders/ORDER_1" },
        { rel: "payer-action", href: "https://paypal.test/approve?token=ORDER_1" },
      ],
    }),
  };
}

describe("createPayPalOrder", () => {
  it("arma el payload con payee, platform_fees y custom_id, y devuelve el approveUrl", async () => {
    h.fetch.mockResolvedValue(okResponse());

    const result = await createPayPalOrder({
      sellerMerchantId: "SELLER_MID",
      currency: "MXN",
      items: [
        { name: "Apunte de Cálculo", amount: 100 },
        { name: "Apunte de Álgebra", amount: 50 },
      ],
      customId: "order:abc",
      platformFee: 30,
      returnUrl: "https://app.test/api/paypal/return",
      cancelUrl: "https://app.test/carrito",
      description: "Compra en apuntesHUB",
    });

    expect(result).toEqual({
      orderId: "ORDER_1",
      approveUrl: "https://paypal.test/approve?token=ORDER_1",
    });

    // Inspeccionar el body enviado a PayPal.
    const [url, init] = h.fetch.mock.calls[0];
    expect(url).toBe("https://api.test/v2/checkout/orders");
    expect(init.headers["PayPal-Auth-Assertion"]).toBe("assert-SELLER_MID");

    const body = JSON.parse(init.body);
    const unit = body.purchase_units[0];
    expect(body.intent).toBe("CAPTURE");
    expect(unit.custom_id).toBe("order:abc");
    expect(unit.payee.merchant_id).toBe("SELLER_MID");
    // total = 100 + 50 = 150.00
    expect(unit.amount.value).toBe("150.00");
    expect(unit.amount.breakdown.item_total.value).toBe("150.00");
    // comisión de plataforma con payee = merchant del partner
    const fee = unit.payment_instruction.platform_fees[0];
    expect(fee.amount.value).toBe("30.00");
    expect(fee.amount.currency_code).toBe("MXN");
    expect(fee.payee.merchant_id).toBe("PARTNER_MID");
  });

  it("lanza si PayPal responde con error", async () => {
    h.fetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "UNPROCESSABLE",
    });

    await expect(
      createPayPalOrder({
        sellerMerchantId: "SELLER_MID",
        currency: "USD",
        items: [{ name: "X", amount: 10 }],
        customId: "abc",
        platformFee: 2,
        returnUrl: "https://app.test/r",
        cancelUrl: "https://app.test/c",
      })
    ).rejects.toThrow(/Error al crear la orden de PayPal/);
  });
});
