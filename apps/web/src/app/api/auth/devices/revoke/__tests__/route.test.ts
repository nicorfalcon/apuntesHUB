import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  lookupMaybeSingle: vi.fn(),
  deleteEq: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    rpc: h.rpc,
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: h.lookupMaybeSingle }),
      }),
      delete: () => ({ eq: h.deleteEq }),
    }),
  }),
}));

import { DELETE } from "../route";

function makeRequest(body: unknown, raw?: string): Request {
  return new Request("http://localhost/api/auth/devices/revoke", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
});

describe("DELETE /api/auth/devices/revoke", () => {
  it("dado un visitante no autenticado, entonces devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(makeRequest({ device_row_id: "x" }));
    expect(res.status).toBe(401);
  });

  it("dado un body inválido (no parsea JSON), entonces devuelve 400 invalid_body", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    const res = await DELETE(makeRequest(null, "no json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_body");
  });

  it("dado un body sin device_row_id, entonces devuelve 400 missing_device_row_id", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    const res = await DELETE(makeRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_device_row_id");
  });

  it("dado un device_row_id que no existe, entonces devuelve 404 not_found", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.lookupMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await DELETE(makeRequest({ device_row_id: "row-x" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_found");
  });

  it("dado un device con session_id, entonces llama RPC revoke_my_session y borra la row", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.lookupMaybeSingle.mockResolvedValue({
      data: { id: "row-1", session_id: "sess-1" },
      error: null,
    });
    h.rpc.mockResolvedValue({ error: null });
    h.deleteEq.mockResolvedValue({ error: null });

    const res = await DELETE(makeRequest({ device_row_id: "row-1" }));
    expect(res.status).toBe(200);
    expect(h.rpc).toHaveBeenCalledWith("revoke_my_session", {
      p_session_id: "sess-1",
    });
    expect(h.deleteEq).toHaveBeenCalled();
  });

  it("dado un device sin session_id, entonces borra la row sin llamar RPC", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.lookupMaybeSingle.mockResolvedValue({
      data: { id: "row-1", session_id: null },
      error: null,
    });
    h.deleteEq.mockResolvedValue({ error: null });

    const res = await DELETE(makeRequest({ device_row_id: "row-1" }));
    expect(res.status).toBe(200);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("dado que el lookup en Supabase falla, entonces devuelve 500 con el mensaje", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.lookupMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const res = await DELETE(makeRequest({ device_row_id: "row-1" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("boom");
  });
});
