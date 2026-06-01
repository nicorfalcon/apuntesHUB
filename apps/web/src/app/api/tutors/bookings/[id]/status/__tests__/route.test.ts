import { describe, it, expect, beforeEach, vi } from "vitest";

// GET /api/tutors/bookings/[id]/status: poll del estado del booking desde la
// página de éxito del checkout de tutoría. Solo el alumno o el tutor lo ven.

const ID = "11111111-1111-4111-8111-111111111111";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  single: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    from: () => {
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = () => c;
      c.or = () => c;
      c.single = h.single;
      return c;
    },
  }),
}));

import { GET } from "../route";

function makeReq(id = ID) {
  return {
    req: new Request(`http://localhost/api/tutors/bookings/${id}/status`) as unknown as Parameters<typeof GET>[0],
    params: Promise.resolve({ id }),
  };
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  h.single.mockResolvedValue({ data: { status: "confirmed" }, error: null });
});

describe("GET tutors/bookings/[id]/status", () => {
  it("devuelve el estado del booking", async () => {
    const { req, params } = makeReq();
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("confirmed");
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const { req, params } = makeReq();
    expect((await GET(req, { params })).status).toBe(401);
  });

  it("si no encuentra el booking (o RLS lo oculta) devuelve 404", async () => {
    h.single.mockResolvedValue({ data: null, error: { message: "no rows" } });
    const { req, params } = makeReq();
    expect((await GET(req, { params })).status).toBe(404);
  });
});
