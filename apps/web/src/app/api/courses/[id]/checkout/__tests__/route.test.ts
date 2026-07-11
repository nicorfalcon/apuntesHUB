import { describe, it, expect, beforeEach, vi } from "vitest";

// Checkout de curso grabado: RPC enroll_course → reusa/crea enrollment, luego
// crea preferencia MP con external_reference `course_enrollment:<id>`.

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

function makeRequest(courseId = "c-1") {
  const req = new Request(
    `http://localhost/api/courses/${courseId}/checkout`,
    { method: "POST" }
  ) as unknown as Parameters<typeof POST>[0];
  return [req, { params: Promise.resolve({ id: courseId }) }] as const;
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test");
});

describe("POST /api/courses/[id]/checkout", () => {
  it("dado un visitante no autenticado, entonces devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    expect(res.status).toBe(401);
  });

  it("dado un courseId vacío, entonces devuelve 400", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    const [req, ctx] = makeRequest("");
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("dado que la RPC enroll_course rechaza, entonces devuelve 400", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({ data: null, error: { message: "blocked" } });
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("blocked");
  });

  it("dado que no se encuentra el enrollment, entonces devuelve 404", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({
      data: { enrollment_id: "e-1", status: "pending", reused: false },
      error: null,
    });
    h.adminSingle.mockResolvedValue({ data: null });
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("dado el camino feliz, entonces devuelve enrollmentId+initPoint con external_reference course_enrollment:<id>", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({
      data: { enrollment_id: "e-1", status: "pending", reused: false },
      error: null,
    });
    h.adminSingle.mockResolvedValue({
      data: {
        id: "e-1",
        amount: 2500,
        platform_fee: 250,
        course_id: "c-1",
        recorded_courses: {
          id: "c-1",
          title: "Curso E2E",
          author_id: "a-1",
        },
      },
    });
    h.getValidAccessToken.mockResolvedValue("tok");
    h.preferenceCreate.mockResolvedValue({
      id: "mp-pref-1",
      init_point: "https://mp.test/c/1",
    });
    h.adminUpdateEq.mockResolvedValue({ data: null });

    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({
      enrollmentId: "e-1",
      preferenceId: "mp-pref-1",
      initPoint: "https://mp.test/c/1",
    });
    expect(h.preferenceCreate).toHaveBeenCalledWith({
      body: expect.objectContaining({
        external_reference: "course_enrollment:e-1",
        marketplace_fee: 250,
      }),
    });
  });

  it("dado que el autor no tiene MP, entonces devuelve 400 con mensaje específico", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({
      data: { enrollment_id: "e-1", status: "pending", reused: false },
      error: null,
    });
    h.adminSingle.mockResolvedValue({
      data: {
        id: "e-1",
        amount: 2500,
        platform_fee: 250,
        course_id: "c-1",
        recorded_courses: { id: "c-1", title: "Curso", author_id: "a-1" },
      },
    });
    h.getValidAccessToken.mockRejectedValue(new Error("no token"));
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Mercado Pago/);
  });

  it("dado un curso gratis, entonces inscribe sin crear preferencia (MP rechaza montos en 0)", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({
      data: { enrollment_id: "e-1", status: "completed", free: true },
      error: null,
    });

    const [req, ctx] = makeRequest("c-1");
    const res = await POST(req, ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.free).toBe(true);
    expect(body.redirectUrl).toBe("/cursos/c-1");
    expect(h.preferenceCreate).not.toHaveBeenCalled();
  });
});
