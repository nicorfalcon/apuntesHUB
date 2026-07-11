import { describe, it, expect, beforeEach, vi } from "vitest";

// POST /api/orders/checkout: crea una orden (bundle o grupo de carrito) y devuelve
// la preferencia de Mercado Pago. Mockeamos los borders: RPC, admin, MP y el token.

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  orderSingle: vi.fn(),
  orderItems: vi.fn(),
  updateEq: vi.fn(),
  getValidAccessToken: vi.fn(),
  preferenceCreate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    rpc: h.rpc,
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "orders") {
        return {
          select: () => ({ eq: () => ({ single: h.orderSingle }) }),
          update: () => ({ eq: h.updateEq }),
        };
      }
      // order_items
      return { select: () => ({ eq: h.orderItems }) };
    },
  }),
}));

vi.mock("@/lib/mercadopago/refresh-token", () => ({
  getValidAccessToken: h.getValidAccessToken,
}));

vi.mock("mercadopago", () => ({
  MercadoPagoConfig: class {},
  Preference: class {
    create = h.preferenceCreate;
  },
}));

import { POST } from "../route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/orders/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test");
});

describe("POST /api/orders/checkout", () => {
  it("401 sin sesión", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeReq({ sellerId: "s1", items: [{ type: "resume", id: "r1" }] }));
    expect(res.status).toBe(401);
  });

  it("400 si faltan items", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const res = await POST(makeReq({ sellerId: "s1", items: [] }));
    expect(res.status).toBe(400);
  });

  it("400 si purchase_order falla", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    h.rpc.mockResolvedValue({ data: null, error: { message: "No podés comprar tus propios materiales" } });
    const res = await POST(makeReq({ sellerId: "u1", items: [{ type: "resume", id: "r1" }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/propios/);
  });

  it("happy path: crea preferencia y devuelve initPoint", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    h.rpc.mockResolvedValue({ data: { order_id: "o1", amount: 1500, status: "pending" }, error: null });
    h.orderSingle.mockResolvedValue({
      data: { amount: 1500, platform_fee: 300, seller_id: "s1" },
      error: null,
    });
    h.orderItems.mockResolvedValue({
      data: [
        { item_type: "bundle", unit_price: 1500, resumes: null, bundles: { title: "Pack Análisis" } },
      ],
      error: null,
    });
    h.getValidAccessToken.mockResolvedValue("token-123");
    h.preferenceCreate.mockResolvedValue({ id: "pref-1", init_point: "https://mp/pay" });
    h.updateEq.mockResolvedValue({ error: null });

    const res = await POST(makeReq({ sellerId: "s1", items: [{ type: "bundle", id: "b1" }] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orderId).toBe("o1");
    expect(body.initPoint).toBe("https://mp/pay");

    // external_reference con prefijo order: y marketplace_fee = platform_fee
    const prefArg = h.preferenceCreate.mock.calls[0][0].body;
    expect(prefArg.external_reference).toBe("order:o1");
    expect(prefArg.marketplace_fee).toBe(300);
    expect(prefArg.items[0].title).toContain("Paquete");
  });

  it("pasa el cupón a la RPC (que lo re-valida server-side)", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    h.rpc.mockResolvedValue({ data: { order_id: "o1", amount: 800, status: "pending" }, error: null });
    h.orderSingle.mockResolvedValue({ data: { amount: 800, platform_fee: 160, seller_id: "s1" }, error: null });
    h.orderItems.mockResolvedValue({
      data: [{ item_type: "resume", unit_price: 800, resumes: { title: "Apunte" }, bundles: null }],
      error: null,
    });
    h.getValidAccessToken.mockResolvedValue("token-123");
    h.preferenceCreate.mockResolvedValue({ id: "pref-1", init_point: "https://mp/pay" });
    h.updateEq.mockResolvedValue({ error: null });

    await POST(
      makeReq({ sellerId: "s1", items: [{ type: "resume", id: "r1" }], couponCode: "PROMO10" })
    );

    expect(h.rpc).toHaveBeenCalledWith("purchase_order", {
      p_seller_id: "s1",
      p_items: [{ type: "resume", id: "r1" }],
      p_coupon_code: "PROMO10",
    });
  });

  it("orden gratis: no crea preferencia de MP (rechaza montos en 0)", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    h.rpc.mockResolvedValue({
      data: { order_id: "o1", amount: 0, status: "completed", free: true },
      error: null,
    });

    const res = await POST(makeReq({ sellerId: "s1", items: [{ type: "resume", id: "r1" }] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.free).toBe(true);
    expect(body.redirectUrl).toBe("/my-purchases");
    expect(h.preferenceCreate).not.toHaveBeenCalled();
  });

  it("400 si el vendedor no tiene MP", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    h.rpc.mockResolvedValue({ data: { order_id: "o1" }, error: null });
    h.orderSingle.mockResolvedValue({ data: { amount: 1500, platform_fee: 300, seller_id: "s1" }, error: null });
    h.orderItems.mockResolvedValue({ data: [], error: null });
    h.getValidAccessToken.mockRejectedValue(new Error("no mp"));

    const res = await POST(makeReq({ sellerId: "s1", items: [{ type: "resume", id: "r1" }] }));
    expect(res.status).toBe(400);
  });
});
