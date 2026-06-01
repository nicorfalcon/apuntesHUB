import { describe, it, expect, beforeEach, vi } from "vitest";

// DELETE /api/ai/api-keys/[id]: baja lógica (is_active=false) de una key BYOK,
// solo si pertenece al usuario autenticado.

const ID = "11111111-1111-4111-8111-111111111111";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  key: { value: null as { id: string } | null },
  updateError: { value: null as { message: string } | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.update = () => c;
      c.eq = () => c;
      c.single = async () => ({ data: h.key.value });
      c.then = (r: (v: unknown) => void) => r({ error: h.updateError.value });
      return c;
    },
  }),
}));

import { DELETE } from "../route";

function makeReq(id = ID) {
  return {
    req: new Request(`http://localhost/api/ai/api-keys/${id}`, { method: "DELETE" }) as unknown as Parameters<typeof DELETE>[0],
    params: Promise.resolve({ id }),
  };
}

beforeEach(() => {
  h.getUser.mockReset();
  h.key.value = { id: ID };
  h.updateError.value = null;
  h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("DELETE ai/api-keys/[id]", () => {
  it("da de baja la key del usuario (200)", async () => {
    const { req, params } = makeReq();
    expect((await DELETE(req, { params })).status).toBe(200);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const { req, params } = makeReq();
    expect((await DELETE(req, { params })).status).toBe(401);
  });

  it("si la key no es del usuario (o no existe) devuelve 404", async () => {
    h.key.value = null;
    const { req, params } = makeReq();
    expect((await DELETE(req, { params })).status).toBe(404);
  });

  it("si falla el update devuelve 500", async () => {
    h.updateError.value = { message: "db" };
    const { req, params } = makeReq();
    expect((await DELETE(req, { params })).status).toBe(500);
  });
});
