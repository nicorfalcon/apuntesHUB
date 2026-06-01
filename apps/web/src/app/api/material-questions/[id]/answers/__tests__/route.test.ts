import { describe, it, expect, beforeEach, vi } from "vitest";

// POST /api/material-questions/[id]/answers: el dueño/autor responde una
// consulta. getQuestionAccess (acceso) ya está testeado; acá validamos las
// ramas del handler.

const QUESTION_ID = "11111111-1111-4111-8111-111111111111";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  getAccess: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    from: () => ({ insert: h.insert }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

vi.mock("@/lib/material-questions", () => ({ getQuestionAccess: h.getAccess }));

vi.mock("@/lib/email/material-question-notifications", () => ({
  notifyBuyersOfMaterialQuestionAnswer: h.notify,
}));

import { POST } from "../route";

function makeRequest(body: unknown, id = QUESTION_ID) {
  const req = new Request(
    `http://localhost/api/material-questions/${id}/answers`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  ) as unknown as Parameters<typeof POST>[0];
  return { req, params: Promise.resolve({ id }) };
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  h.getUser.mockResolvedValue({ data: { user: { id: "seller-1" } } });
  h.insert.mockResolvedValue({ error: null });
  h.getAccess.mockResolvedValue({ question: { id: QUESTION_ID }, canAnswer: true });
  h.notify.mockResolvedValue(undefined);
});

describe("POST answers", () => {
  it("dado el dueño con permiso, publica la respuesta (201)", async () => {
    const { req, params } = makeRequest({ body: "Una respuesta clara y completa." });
    const res = await POST(req, { params });
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBeTruthy();
    expect(h.insert).toHaveBeenCalledTimes(1);
  });

  it("con id no-uuid devuelve 400", async () => {
    const { req, params } = makeRequest({ body: "ok" }, "no-uuid");
    expect((await POST(req, { params })).status).toBe(400);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const { req, params } = makeRequest({ body: "ok" });
    expect((await POST(req, { params })).status).toBe(401);
  });

  it("con body vacío devuelve 400", async () => {
    const { req, params } = makeRequest({ body: "" });
    expect((await POST(req, { params })).status).toBe(400);
  });

  it("si la consulta no existe devuelve 404", async () => {
    h.getAccess.mockResolvedValue({ question: null, canAnswer: false });
    const { req, params } = makeRequest({ body: "respuesta" });
    expect((await POST(req, { params })).status).toBe(404);
  });

  it("si no puede responder devuelve 403", async () => {
    h.getAccess.mockResolvedValue({ question: { id: QUESTION_ID }, canAnswer: false });
    const { req, params } = makeRequest({ body: "respuesta" });
    expect((await POST(req, { params })).status).toBe(403);
  });

  it("si falla el insert devuelve 500", async () => {
    h.insert.mockResolvedValue({ error: { message: "db" } });
    const { req, params } = makeRequest({ body: "respuesta" });
    expect((await POST(req, { params })).status).toBe(500);
  });
});
