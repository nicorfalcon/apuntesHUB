import { describe, it, expect, beforeEach, vi } from "vitest";

// POST /api/mercadopago/disconnect: el vendedor desconecta su cuenta de MP
// (borra sus credenciales).

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  deleteError: { value: null as { message: string } | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const c: Record<string, unknown> = {};
      c.delete = () => c;
      c.eq = () => c;
      c.then = (r: (v: unknown) => void) => r({ error: h.deleteError.value });
      return c;
    },
  }),
}));

import { POST } from "../route";

beforeEach(() => {
  h.getUser.mockReset();
  h.deleteError.value = null;
  h.getUser.mockResolvedValue({ data: { user: { id: "seller-1" } } });
});

describe("POST mercadopago/disconnect", () => {
  it("desconecta la cuenta del vendedor (200)", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST()).status).toBe(401);
  });

  it("si falla el borrado devuelve 500", async () => {
    h.deleteError.value = { message: "db" };
    expect((await POST()).status).toBe(500);
  });
});
