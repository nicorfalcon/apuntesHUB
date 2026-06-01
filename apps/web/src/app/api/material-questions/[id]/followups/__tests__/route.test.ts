import { describe, it, expect, beforeEach, vi } from "vitest";

// POST /api/material-questions/[id]/followups: continúa el hilo. Puede hacerlo
// el autor de la consulta (rol buyer) o quien puede responder (rol owner).

const QUESTION_ID = "11111111-1111-4111-8111-111111111111";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  getAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    from: () => ({ insert: h.insert }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/material-questions", () => ({ getQuestionAccess: h.getAccess }));

import { POST } from "../route";

function makeRequest(body: unknown, id = QUESTION_ID) {
  const req = new Request(
    `http://localhost/api/material-questions/${id}/followups`,
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
  h.getUser.mockResolvedValue({ data: { user: { id: "buyer-1" } } });
  h.insert.mockResolvedValue({ error: null });
  h.getAccess.mockResolvedValue({
    question: { id: QUESTION_ID, status: "open" },
    isQuestionAuthor: true,
    canAnswer: false,
  });
});

describe("POST followups", () => {
  it("dado el autor de la consulta abierta, agrega un followup con rol buyer (201)", async () => {
    const { req, params } = makeRequest({ body: "Sigo con una duda más." });
    const res = await POST(req, { params });
    expect(res.status).toBe(201);
    expect((await res.json()).role).toBe("buyer");
  });

  it("dado el dueño (puede responder), agrega un followup con rol owner (201)", async () => {
    h.getAccess.mockResolvedValue({
      question: { id: QUESTION_ID, status: "open" },
      isQuestionAuthor: false,
      canAnswer: true,
    });
    const { req, params } = makeRequest({ body: "Te amplío la respuesta." });
    const res = await POST(req, { params });
    expect(res.status).toBe(201);
    expect((await res.json()).role).toBe("owner");
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const { req, params } = makeRequest({ body: "hola" });
    expect((await POST(req, { params })).status).toBe(401);
  });

  it("con la consulta oculta (hidden) devuelve 403", async () => {
    h.getAccess.mockResolvedValue({
      question: { id: QUESTION_ID, status: "hidden" },
      isQuestionAuthor: true,
      canAnswer: false,
    });
    const { req, params } = makeRequest({ body: "hola" });
    expect((await POST(req, { params })).status).toBe(403);
  });

  it("si un tercero sin acceso intenta seguir el hilo devuelve 403", async () => {
    h.getAccess.mockResolvedValue({
      question: { id: QUESTION_ID, status: "open" },
      isQuestionAuthor: false,
      canAnswer: false,
    });
    const { req, params } = makeRequest({ body: "hola" });
    expect((await POST(req, { params })).status).toBe(403);
  });

  it("si la consulta no existe devuelve 404", async () => {
    h.getAccess.mockResolvedValue({ question: null });
    const { req, params } = makeRequest({ body: "hola" });
    expect((await POST(req, { params })).status).toBe(404);
  });
});
