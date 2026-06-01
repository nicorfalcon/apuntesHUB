import { describe, it, expect, beforeEach, vi } from "vitest";

// POST/DELETE /api/material-questions/[id]/me-too: un comprador con acceso marca
// (o desmarca) que también tiene esa duda. Ambos verbos comparten ensureCanReact.

const QUESTION_ID = "11111111-1111-4111-8111-111111111111";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  getAccess: vi.fn(),
  adminError: { value: null as { message: string } | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const c: Record<string, unknown> = {};
      c.upsert = async () => ({ error: h.adminError.value });
      c.delete = () => c;
      c.eq = () => c;
      c.then = (r: (v: unknown) => void) => r({ error: h.adminError.value });
      return c;
    },
  }),
}));

vi.mock("@/lib/material-questions", () => ({ getQuestionAccess: h.getAccess }));

import { POST, DELETE } from "../route";

function params(id = QUESTION_ID) {
  return {
    req: new Request(`http://localhost/api/material-questions/${id}/me-too`),
    params: Promise.resolve({ id }),
  };
}

beforeEach(() => {
  h.getUser.mockReset();
  h.getAccess.mockReset();
  h.adminError.value = null;
  h.getUser.mockResolvedValue({ data: { user: { id: "buyer-1" } } });
  h.getAccess.mockResolvedValue({ question: { id: QUESTION_ID }, canReact: true });
});

describe("me-too", () => {
  it("POST marca la duda (200)", async () => {
    const { req, params: p } = params();
    expect((await POST(req, { params: p })).status).toBe(200);
  });

  it("DELETE desmarca la duda (200)", async () => {
    const { req, params: p } = params();
    expect((await DELETE(req, { params: p })).status).toBe(200);
  });

  it("con id no-uuid devuelve 400", async () => {
    const { req, params: p } = params("no-uuid");
    expect((await POST(req, { params: p })).status).toBe(400);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const { req, params: p } = params();
    expect((await POST(req, { params: p })).status).toBe(401);
  });

  it("si la consulta no existe devuelve 404", async () => {
    h.getAccess.mockResolvedValue({ question: null, canReact: false });
    const { req, params: p } = params();
    expect((await POST(req, { params: p })).status).toBe(404);
  });

  it("si no tiene acceso para reaccionar devuelve 403", async () => {
    h.getAccess.mockResolvedValue({ question: { id: QUESTION_ID }, canReact: false });
    const { req, params: p } = params();
    expect((await POST(req, { params: p })).status).toBe(403);
  });

  it("si falla la escritura devuelve 500", async () => {
    h.adminError.value = { message: "db" };
    const { req, params: p } = params();
    expect((await POST(req, { params: p })).status).toBe(500);
  });
});
