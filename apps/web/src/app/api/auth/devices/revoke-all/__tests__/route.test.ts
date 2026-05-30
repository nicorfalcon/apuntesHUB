import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  deleteEq: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    rpc: h.rpc,
    from: () => ({ delete: () => ({ eq: h.deleteEq }) }),
  }),
}));

import { POST } from "../route";

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
});

describe("POST /api/auth/devices/revoke-all", () => {
  it("dado un visitante no autenticado, entonces devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("dado un usuario válido, entonces llama RPC revoke_all_my_sessions y borra todas sus devices", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({ error: null });
    h.deleteEq.mockResolvedValue({ error: null });

    const res = await POST();
    expect(res.status).toBe(200);
    expect(h.rpc).toHaveBeenCalledWith("revoke_all_my_sessions");
    expect(h.deleteEq).toHaveBeenCalledWith("user_id", "u-1");
  });

  it("dado que la RPC falla, entonces devuelve 500 con el mensaje", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({ error: { message: "rpc-err" } });
    const res = await POST();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("rpc-err");
  });

  it("dado que la RPC ok pero el DELETE falla, entonces devuelve 500", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.rpc.mockResolvedValue({ error: null });
    h.deleteEq.mockResolvedValue({ error: { message: "delete-err" } });
    const res = await POST();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("delete-err");
  });
});
