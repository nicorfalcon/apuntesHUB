import { describe, it, expect, beforeEach, vi } from "vitest";

// Igual al patrón de create-preference para resumes pero con la RPC
// `create_tutoring_booking` y el external_reference `tutoring_booking:<id>`.

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
      select: () => ({
        eq: () => ({
          eq: () => ({ single: h.adminSingle }),
        }),
      }),
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
  return new Request(
    "http://localhost/api/mercadopago/create-tutoring-preference",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }
  ) as unknown as Parameters<typeof POST>[0];
}

const validBody = {
  tutor_id: "t-1",
  subject_id: "sub-1",
  scheduled_at: "2026-06-01T18:00:00Z",
  duration_minutes: 60,
  modality: "online",
  initial_message: "hola",
};

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test");
});

describe("POST /api/mercadopago/create-tutoring-preference", () => {
  it("dado un visitante no autenticado, entonces devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("dado un body que no parsea JSON, entonces devuelve 400 con 'Body inválido'", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    const res = await POST(makeRequest(null, "no json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Body inválido/i);
  });

  it("dado un body sin campos requeridos, entonces devuelve 400", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    const res = await POST(makeRequest({ tutor_id: "t-1" }));
    expect(res.status).toBe(400);
  });

  it("dado que la RPC create_tutoring_booking rechaza, entonces devuelve 400 con su mensaje", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({
      data: null,
      error: { message: "slot_taken" },
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("slot_taken");
  });

  it("dado que el tutor no tiene MP conectado, entonces devuelve 400 y marca el booking como failed", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({
      data: {
        booking_id: "b-1",
        amount: 3500,
        platform_fee: 350,
        seller_amount: 3150,
        status: "pending",
        payment_expires_at: "2026-06-01T18:10:00Z",
      },
      error: null,
    });
    h.adminSingle.mockResolvedValue({ data: { subjects: { name: "Análisis I" } } });
    h.getValidAccessToken.mockRejectedValue(new Error("no token"));
    h.adminUpdateEq.mockResolvedValue({ data: null });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Mercado Pago/);
    // Booking marcado como failed.
    expect(h.adminUpdateEq).toHaveBeenCalledWith("id", "b-1");
  });

  it("dado el camino feliz, entonces devuelve initPoint+expiresAt y persiste mp_preference_id", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({
      data: {
        booking_id: "b-1",
        amount: 3500,
        platform_fee: 350,
        seller_amount: 3150,
        status: "pending",
        payment_expires_at: "2026-06-01T18:10:00Z",
      },
      error: null,
    });
    h.adminSingle.mockResolvedValue({ data: { subjects: { name: "Análisis I" } } });
    h.getValidAccessToken.mockResolvedValue("seller-token");
    h.preferenceCreate.mockResolvedValue({
      id: "mp-pref-1",
      init_point: "https://mp.test/c/1",
    });
    h.adminUpdateEq.mockResolvedValue({ data: null });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({
      bookingId: "b-1",
      preferenceId: "mp-pref-1",
      initPoint: "https://mp.test/c/1",
      amount: 3500,
      expiresAt: "2026-06-01T18:10:00Z",
    });
    // external_reference debe llevar el prefijo tutoring_booking:
    expect(h.preferenceCreate).toHaveBeenCalledWith({
      body: expect.objectContaining({
        external_reference: "tutoring_booking:b-1",
        marketplace_fee: 350,
      }),
    });
  });

  it("dado que MP rechaza la creación, entonces devuelve 500 y marca el booking como failed", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({
      data: {
        booking_id: "b-1",
        amount: 3500,
        platform_fee: 350,
        seller_amount: 3150,
        status: "pending",
        payment_expires_at: "2026-06-01T18:10:00Z",
      },
      error: null,
    });
    h.adminSingle.mockResolvedValue({ data: { subjects: { name: "Análisis I" } } });
    h.getValidAccessToken.mockResolvedValue("seller-token");
    h.preferenceCreate.mockRejectedValue(new Error("mp down"));
    h.adminUpdateEq.mockResolvedValue({ data: null });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).detail).toBe("mp down");
    expect(h.adminUpdateEq).toHaveBeenCalledWith("id", "b-1");
  });
});
