import { describe, it, expect, beforeEach, vi } from "vitest";

// POST /api/material-questions: crear una consulta sobre un apunte o un curso.
// La lógica de acceso (getResume/CourseQuestionAccess) ya tiene tests de unidad;
// acá validamos la orquestación del handler: validaciones de body, ramas
// resume/course y persistencia. validateMaterialQuestionText corre de verdad.

const RESUME_ID = "11111111-1111-4111-8111-111111111111";
const COURSE_ID = "22222222-2222-4222-8222-222222222222";
const MODULE_ID = "33333333-3333-4333-8333-333333333333";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  resumeAccess: vi.fn(),
  courseAccess: vi.fn(),
  moduleBelongs: vi.fn(),
  notifyOwner: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    from: () => ({ insert: h.insert }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/material-questions", () => ({
  getResumeQuestionAccess: h.resumeAccess,
  getCourseQuestionAccess: h.courseAccess,
  validateCourseModuleBelongsToCourse: h.moduleBelongs,
}));

vi.mock("@/lib/email/material-question-notifications", () => ({
  notifyOwnerOfNewMaterialQuestion: h.notifyOwner,
}));

import { POST } from "../route";

function makeRequest(body: unknown, raw?: string) {
  return new Request("http://localhost/api/material-questions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

const RESUME_BODY = {
  targetType: "resume",
  resumeId: RESUME_ID,
  anchorPage: 1,
  title: "Título válido de consulta",
  body: "Detalle suficiente de la consulta para pasar la validación.",
  isAnonymousToBuyers: false,
};

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  h.getUser.mockResolvedValue({ data: { user: { id: "buyer-1" } } });
  h.insert.mockResolvedValue({ error: null });
  h.resumeAccess.mockResolvedValue({ exists: true, canAsk: true });
  h.courseAccess.mockResolvedValue({ exists: true, canAsk: true });
  h.moduleBelongs.mockResolvedValue(true);
  h.notifyOwner.mockResolvedValue(undefined);
});

describe("POST /api/material-questions", () => {
  it("dado un comprador con acceso, crea la consulta de apunte (201)", async () => {
    const res = await POST(makeRequest(RESUME_BODY));
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBeTruthy();
    expect(h.insert).toHaveBeenCalledTimes(1);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(makeRequest(RESUME_BODY))).status).toBe(401);
  });

  it("con body que no parsea JSON devuelve 400", async () => {
    expect((await POST(makeRequest(null, "no-json"))).status).toBe(400);
  });

  it("con targetType inválido devuelve 400", async () => {
    expect((await POST(makeRequest({ ...RESUME_BODY, targetType: "x" }))).status).toBe(400);
  });

  it("con título demasiado corto devuelve 400", async () => {
    expect((await POST(makeRequest({ ...RESUME_BODY, title: "corto" }))).status).toBe(400);
  });

  it("si el apunte no existe devuelve 404", async () => {
    h.resumeAccess.mockResolvedValue({ exists: false, canAsk: false });
    expect((await POST(makeRequest(RESUME_BODY))).status).toBe(404);
  });

  it("si no compró el apunte devuelve 403", async () => {
    h.resumeAccess.mockResolvedValue({ exists: true, canAsk: false });
    expect((await POST(makeRequest(RESUME_BODY))).status).toBe(403);
  });

  it("si falla el insert devuelve 500", async () => {
    h.insert.mockResolvedValue({ error: { message: "db" } });
    expect((await POST(makeRequest(RESUME_BODY))).status).toBe(500);
  });

  it("crea una consulta de curso con módulo válido (201)", async () => {
    const res = await POST(
      makeRequest({
        targetType: "course",
        courseId: COURSE_ID,
        moduleId: MODULE_ID,
        anchorSeconds: 30,
        title: "Título válido de consulta",
        body: "Detalle suficiente de la consulta para pasar la validación.",
        isAnonymousToBuyers: false,
      })
    );
    expect(res.status).toBe(201);
  });

  it("si el módulo no pertenece al curso devuelve 400", async () => {
    h.moduleBelongs.mockResolvedValue(false);
    const res = await POST(
      makeRequest({
        targetType: "course",
        courseId: COURSE_ID,
        moduleId: MODULE_ID,
        title: "Título válido de consulta",
        body: "Detalle suficiente de la consulta para pasar la validación.",
      })
    );
    expect(res.status).toBe(400);
  });

  it("si no tiene inscripción al curso devuelve 403", async () => {
    h.courseAccess.mockResolvedValue({ exists: true, canAsk: false });
    const res = await POST(
      makeRequest({
        targetType: "course",
        courseId: COURSE_ID,
        title: "Título válido de consulta",
        body: "Detalle suficiente de la consulta para pasar la validación.",
      })
    );
    expect(res.status).toBe(403);
  });
});
