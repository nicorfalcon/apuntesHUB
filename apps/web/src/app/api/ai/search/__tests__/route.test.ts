import { describe, it, expect, beforeEach, vi } from "vitest";

// POST /api/ai/search: búsqueda semántica sobre apuntes comprados. Genera el
// embedding de la query y llama al RPC search_chunks_for_study. Mockeamos el
// embedding y el rpc (la lógica de embeddings ya tiene tests de unidad).

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  embedding: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser }, rpc: h.rpc }),
}));

vi.mock("@/lib/ai/embeddings", () => ({ generateQueryEmbedding: h.embedding }));

import { POST } from "../route";

function makeReq(body: unknown, raw?: string) {
  return new Request("http://localhost/api/ai/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  h.getUser.mockResolvedValue({ data: { user: { id: "buyer-1" } } });
  h.embedding.mockResolvedValue([0.1, 0.2, 0.3]);
  h.rpc.mockResolvedValue({ data: [{ chunk: "resultado" }], error: null });
});

describe("POST ai/search", () => {
  it("dado una query válida, devuelve los resultados del RPC", async () => {
    const res = await POST(makeReq({ query: "qué es ACID" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.query).toBe("qué es ACID");
    expect(json.results).toHaveLength(1);
    expect(h.embedding).toHaveBeenCalledWith("qué es ACID");
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(makeReq({ query: "x" }))).status).toBe(401);
  });

  it("con body no-JSON devuelve 400", async () => {
    expect((await POST(makeReq(null, "no-json"))).status).toBe(400);
  });

  it("con query vacía devuelve 400", async () => {
    expect((await POST(makeReq({ query: "   " }))).status).toBe(400);
  });

  it("si falla la generación del embedding devuelve 500", async () => {
    h.embedding.mockRejectedValue(new Error("openai down"));
    expect((await POST(makeReq({ query: "hola" }))).status).toBe(500);
  });

  it("si el RPC de búsqueda falla devuelve 500", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "db" } });
    expect((await POST(makeReq({ query: "hola" }))).status).toBe(500);
  });
});
