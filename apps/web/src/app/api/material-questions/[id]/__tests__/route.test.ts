import { describe, it, expect, beforeEach, vi } from "vitest";

// PATCH/DELETE /api/material-questions/[id]: editar contenido, cambiar estado o
// borrar una consulta, con reglas distintas para autor vs moderador (dueño).
// getQuestionAccess da los permisos; validateMaterialQuestionText corre de verdad.

const ID = "11111111-1111-4111-8111-111111111111";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  getAccess: vi.fn(),
  serverError: { value: null as { message: string } | null },
  answersCount: { value: 0 },
  followupsCount: { value: 0 },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    from: () => {
      const c: Record<string, unknown> = {};
      c.update = () => c;
      c.delete = () => c;
      c.eq = () => c;
      c.then = (r: (v: unknown) => void) => r({ error: h.serverError.value });
      return c;
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const count =
        table === "material_question_answers"
          ? h.answersCount.value
          : h.followupsCount.value;
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = () => c;
      c.then = (r: (v: unknown) => void) => r({ count });
      return c;
    },
  }),
}));

vi.mock("@/lib/material-questions", () => ({ getQuestionAccess: h.getAccess }));

import { PATCH, DELETE } from "../route";

function makeReq(body: unknown, raw?: string, id = ID) {
  const req = new Request(`http://localhost/api/material-questions/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  }) as unknown as Parameters<typeof PATCH>[0];
  return { req, params: Promise.resolve({ id }) };
}

const VALID_CONTENT = {
  title: "Título editado válido",
  body: "Detalle editado con longitud suficiente.",
  isAnonymousToBuyers: false,
};

beforeEach(() => {
  h.getUser.mockReset();
  h.getAccess.mockReset();
  h.serverError.value = null;
  h.answersCount.value = 0;
  h.followupsCount.value = 0;
  h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  h.getAccess.mockResolvedValue({
    question: { id: ID, status: "open" },
    canView: true,
    isQuestionAuthor: true,
    canModerate: false,
  });
});

describe("PATCH material-questions/[id]", () => {
  it("el autor edita contenido de una consulta abierta sin respuestas (200)", async () => {
    const { req, params } = makeReq(VALID_CONTENT);
    expect((await PATCH(req, { params })).status).toBe(200);
  });

  it("el moderador cambia el estado a hidden (200)", async () => {
    h.getAccess.mockResolvedValue({
      question: { id: ID, status: "open" },
      canView: true,
      isQuestionAuthor: false,
      canModerate: true,
    });
    const { req, params } = makeReq({ status: "hidden" });
    expect((await PATCH(req, { params })).status).toBe(200);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const { req, params } = makeReq({ status: "hidden" });
    expect((await PATCH(req, { params })).status).toBe(401);
  });

  it("mezclar contenido y estado devuelve 400", async () => {
    const { req, params } = makeReq({ status: "hidden", title: "x" });
    expect((await PATCH(req, { params })).status).toBe(400);
  });

  it("si la consulta no existe devuelve 404", async () => {
    h.getAccess.mockResolvedValue({ question: null });
    const { req, params } = makeReq({ status: "hidden" });
    expect((await PATCH(req, { params })).status).toBe(404);
  });

  it("editar contenido sin ser el autor devuelve 403", async () => {
    h.getAccess.mockResolvedValue({
      question: { id: ID, status: "open" },
      canView: true,
      isQuestionAuthor: false,
      canModerate: true,
    });
    const { req, params } = makeReq(VALID_CONTENT);
    expect((await PATCH(req, { params })).status).toBe(403);
  });

  it("editar una consulta que ya tiene respuestas devuelve 409", async () => {
    h.answersCount.value = 1;
    const { req, params } = makeReq(VALID_CONTENT);
    expect((await PATCH(req, { params })).status).toBe(409);
  });

  it("un cambio de estado no permitido devuelve 403", async () => {
    h.getAccess.mockResolvedValue({
      question: { id: ID, status: "open" },
      canView: true,
      isQuestionAuthor: false,
      canModerate: false,
    });
    const { req, params } = makeReq({ status: "hidden" });
    expect((await PATCH(req, { params })).status).toBe(403);
  });
});

describe("DELETE material-questions/[id]", () => {
  function delReq(id = ID) {
    return {
      req: new Request(`http://localhost/api/material-questions/${id}`, {
        method: "DELETE",
      }) as unknown as Parameters<typeof DELETE>[0],
      params: Promise.resolve({ id }),
    };
  }

  it("el moderador borra la consulta (200)", async () => {
    h.getAccess.mockResolvedValue({
      question: { id: ID, status: "open" },
      isQuestionAuthor: false,
      canModerate: true,
    });
    const { req, params } = delReq();
    expect((await DELETE(req, { params })).status).toBe(200);
  });

  it("el autor borra su consulta abierta sin respuestas (200)", async () => {
    const { req, params } = delReq();
    expect((await DELETE(req, { params })).status).toBe(200);
  });

  it("sin permisos devuelve 403", async () => {
    h.getAccess.mockResolvedValue({
      question: { id: ID, status: "answered" },
      isQuestionAuthor: false,
      canModerate: false,
    });
    const { req, params } = delReq();
    expect((await DELETE(req, { params })).status).toBe(403);
  });

  it("el autor no puede borrar si ya tiene respuestas (409)", async () => {
    h.answersCount.value = 1;
    const { req, params } = delReq();
    expect((await DELETE(req, { params })).status).toBe(409);
  });
});
