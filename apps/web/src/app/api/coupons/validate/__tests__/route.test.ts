import { describe, it, expect, beforeEach, vi } from "vitest";

// POST /api/coupons/validate: valida un cupón para un apunte vía la RPC validate_coupon.

const h = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    rpc: h.rpc,
  }),
}));

import { POST } from "../route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/coupons/validate", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  h.getUser.mockResolvedValue({ data: { user: { id: "buyer-1" } } });
});

describe("POST /api/coupons/validate", () => {
  it("401 sin sesión", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeReq({ code: "X", resumeId: "r1" }));
    expect(res.status).toBe(401);
  });

  it("400 si faltan campos", async () => {
    const res = await POST(makeReq({ code: "X" }));
    expect(res.status).toBe(400);
  });

  it("devuelve el resultado válido de la RPC", async () => {
    h.rpc.mockResolvedValue({
      data: {
        valid: true,
        code: "PARCIAL20",
        discount_amount: 200,
        original_amount: 1000,
        final_amount: 800,
      },
      error: null,
    });
    const res = await POST(makeReq({ code: "parcial20", resumeId: "r1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.final_amount).toBe(800);
    expect(h.rpc).toHaveBeenCalledWith("validate_coupon", {
      p_code: "parcial20",
      p_resume_id: "r1",
    });
  });

  it("propaga un cupón inválido de la RPC", async () => {
    h.rpc.mockResolvedValue({
      data: { valid: false, error: "El código expiró" },
      error: null,
    });
    const res = await POST(makeReq({ code: "VIEJO", resumeId: "r1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ valid: false, error: "El código expiró" });
  });

  it("500 si la RPC falla", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(makeReq({ code: "X", resumeId: "r1" }));
    expect(res.status).toBe(500);
  });
});
