import { describe, it, expect, beforeEach, vi } from "vitest";

// POST/DELETE /api/material-answers/[id]/helpful: voto "útil" de un comprador con
// acceso sobre una respuesta. Resuelve la respuesta -> su consulta -> acceso.

const ANSWER_ID = "11111111-1111-4111-8111-111111111111";
const QUESTION_ID = "22222222-2222-4222-8222-222222222222";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  getAccess: vi.fn(),
  answer: { value: null as { id: string; question_id: string } | null },
  adminError: { value: null as { message: string } | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "material_question_answers") {
        const c: Record<string, unknown> = {};
        c.select = () => c;
        c.eq = () => c;
        c.maybeSingle = async () => ({ data: h.answer.value });
        return c;
      }
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

function params(id = ANSWER_ID) {
  return {
    req: new Request(`http://localhost/api/material-answers/${id}/helpful`),
    params: Promise.resolve({ id }),
  };
}

beforeEach(() => {
  h.getUser.mockReset();
  h.getAccess.mockReset();
  h.answer.value = { id: ANSWER_ID, question_id: QUESTION_ID };
  h.adminError.value = null;
  h.getUser.mockResolvedValue({ data: { user: { id: "buyer-1" } } });
  h.getAccess.mockResolvedValue({ question: { id: QUESTION_ID }, canReact: true });
});

describe("helpful", () => {
  it("POST registra el voto útil (200)", async () => {
    const { req, params: p } = params();
    expect((await POST(req, { params: p })).status).toBe(200);
  });

  it("DELETE quita el voto (200)", async () => {
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

  it("si la respuesta no existe devuelve 404", async () => {
    h.answer.value = null;
    const { req, params: p } = params();
    expect((await POST(req, { params: p })).status).toBe(404);
  });

  it("si la consulta no existe devuelve 404", async () => {
    h.getAccess.mockResolvedValue({ question: null, canReact: false });
    const { req, params: p } = params();
    expect((await POST(req, { params: p })).status).toBe(404);
  });

  it("si no tiene acceso para votar devuelve 403", async () => {
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
