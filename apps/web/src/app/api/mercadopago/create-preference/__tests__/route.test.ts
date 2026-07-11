import { describe, it, expect, beforeEach, vi } from "vitest";

// Mockeamos el SDK de MercadoPago (constructor + Preference.create) y el
// helper getValidAccessToken. La lógica de la RPC `purchase_resume` y la
// query admin quedan mockeadas en el límite porque son borders del sistema.

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  adminSingle: vi.fn(),
  adminUpdateEq: vi.fn(),
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
    from: () => ({
      select: () => ({ eq: () => ({ single: h.adminSingle }) }),
      update: () => ({ eq: h.adminUpdateEq }),
    }),
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

function makeRequest(body: unknown, raw?: string) {
  return new Request("http://localhost/api/mercadopago/create-preference", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test");
});

describe("POST /api/mercadopago/create-preference", () => {
  it("dado un visitante no autenticado, entonces devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest({ resumeId: "r-1" }));
    expect(res.status).toBe(401);
  });

  it("dado un body sin resumeId, entonces devuelve 400", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/resumeId/);
  });

  it("dado que la RPC purchase_resume falla, entonces devuelve 400 con el mensaje", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({
      data: null,
      error: { message: "already_purchased" },
    });
    const res = await POST(makeRequest({ resumeId: "r-1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("already_purchased");
  });

  it("dado que no se encuentra la purchase reservada, entonces devuelve 404", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({
      data: { purchase_id: "p-1", status: "pending", reused: false },
      error: null,
    });
    h.adminSingle.mockResolvedValue({ data: null });
    const res = await POST(makeRequest({ resumeId: "r-1" }));
    expect(res.status).toBe(404);
  });

  it("dado que el vendedor no tiene MP conectado, entonces devuelve 400 con mensaje específico", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({
      data: { purchase_id: "p-1", status: "pending", reused: false },
      error: null,
    });
    h.adminSingle.mockResolvedValue({
      data: {
        amount: 1000,
        seller_id: "s-1",
        platform_fee: 100,
        resumes: { title: "Apunte" },
      },
    });
    h.getValidAccessToken.mockRejectedValue(new Error("no token"));
    const res = await POST(makeRequest({ resumeId: "r-1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Mercado Pago/);
  });

  it("dado el camino feliz, entonces devuelve preferenceId+initPoint y persiste el mp_preference_id", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({
      data: { purchase_id: "p-1", status: "pending", reused: false },
      error: null,
    });
    h.adminSingle.mockResolvedValue({
      data: {
        amount: 1500,
        seller_id: "s-1",
        platform_fee: 150,
        resumes: { title: "Apunte E2E" },
      },
    });
    h.getValidAccessToken.mockResolvedValue("seller-token");
    h.preferenceCreate.mockResolvedValue({
      id: "mp-pref-1",
      init_point: "https://mp.test/checkout/1",
    });
    h.adminUpdateEq.mockResolvedValue({ data: null });

    const res = await POST(makeRequest({ resumeId: "r-1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({
      preferenceId: "mp-pref-1",
      initPoint: "https://mp.test/checkout/1",
    });
    // Verifica que el body enviado a MP incluye el item con el price correcto
    // y el marketplace_fee.
    expect(h.preferenceCreate).toHaveBeenCalledWith({
      body: expect.objectContaining({
        items: [
          expect.objectContaining({ unit_price: 1500, title: "Apunte E2E" }),
        ],
        marketplace_fee: 150,
        external_reference: "p-1",
      }),
    });
    // Persistió el preference id en la compra.
    expect(h.adminUpdateEq).toHaveBeenCalledWith("id", "p-1");
  });

  it("dado que MP rechaza la creación de preferencia, entonces devuelve 500 con detail", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({
      data: { purchase_id: "p-1", status: "pending", reused: false },
      error: null,
    });
    h.adminSingle.mockResolvedValue({
      data: {
        amount: 1000,
        seller_id: "s-1",
        platform_fee: 100,
        resumes: { title: "Apunte" },
      },
    });
    h.getValidAccessToken.mockResolvedValue("seller-token");
    h.preferenceCreate.mockRejectedValue(new Error("mp boom"));

    const res = await POST(makeRequest({ resumeId: "r-1" }));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.detail).toBe("mp boom");
  });

  it("dado un apunte gratis, entonces no crea preferencia (MP rechaza montos en 0)", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({
      data: { purchase_id: "p-1", status: "completed", free: true },
      error: null,
    });

    const res = await POST(makeRequest({ resumeId: "r-1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.free).toBe(true);
    expect(body.redirectUrl).toBe("/my-purchases");
    expect(h.preferenceCreate).not.toHaveBeenCalled();
  });
});
