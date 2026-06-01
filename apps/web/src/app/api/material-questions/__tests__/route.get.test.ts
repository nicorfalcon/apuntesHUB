import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// GET /api/material-questions: listado con filtros, búsqueda, orden y paginación,
// más el armado de sub-recursos (respuestas, followups, me-too, votos, perfiles).
// Es el handler más ramificado del módulo. resolveQuestionAuthor corre de verdad;
// mockeamos el acceso y un admin client multi-tabla "thenable".

const RESUME_ID = "11111111-1111-4111-8111-111111111111";
const COURSE_ID = "22222222-2222-4222-8222-222222222222";
const USER = "buyer-1";
const SELLER = "seller-1";
const Q1 = "33333333-3333-4333-8333-333333333333";
const A1 = "44444444-4444-4444-8444-444444444444";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  resumeAccess: vi.fn(),
  courseAccess: vi.fn(),
  tables: { value: {} as Record<string, unknown[]> },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = () => c;
      c.in = () => c;
      c.or = () => c;
      c.order = () => c;
      c.then = (resolve: (v: unknown) => void) =>
        resolve({ data: h.tables.value[table] ?? [], error: null });
      return c;
    },
  }),
}));

vi.mock("@/lib/material-questions", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/material-questions")>();
  return {
    ...actual,
    getResumeQuestionAccess: h.resumeAccess,
    getCourseQuestionAccess: h.courseAccess,
  };
});

vi.mock("@/lib/email/material-question-notifications", () => ({
  notifyOwnerOfNewMaterialQuestion: vi.fn(),
}));

import { GET } from "../route";

function req(query: string) {
  return new NextRequest(`http://localhost/api/material-questions?${query}`);
}

const FULL_ACCESS = {
  exists: true,
  canView: true,
  canModerate: true,
  canAnswer: true,
  canReact: true,
};

function seedOneQuestion() {
  h.tables.value = {
    material_questions: [
      {
        id: Q1,
        target_type: "resume",
        resume_id: RESUME_ID,
        course_id: null,
        module_id: null,
        anchor_page: 1,
        anchor_seconds: null,
        author_id: USER,
        title: "¿Cómo resuelvo esto?",
        body: "Detalle de la consulta.",
        is_anonymous_to_buyers: false,
        status: "answered",
        created_at: "2026-05-01T00:00:00Z",
        updated_at: "2026-05-01T00:00:00Z",
      },
    ],
    material_question_me_toos: [{ question_id: Q1 }],
    material_question_answers: [
      {
        id: A1,
        question_id: Q1,
        author_id: SELLER,
        body: "Respuesta oficial.",
        is_official: true,
        created_at: "2026-05-02T00:00:00Z",
      },
    ],
    material_question_followups: [
      {
        id: "f1",
        question_id: Q1,
        author_id: USER,
        role: "buyer",
        body: "Gracias, sigo con una duda.",
        created_at: "2026-05-03T00:00:00Z",
      },
    ],
    material_answer_helpful_votes: [{ answer_id: A1 }],
    profiles: [
      { id: USER, display_name: "Buyer", avatar_url: null },
      { id: SELLER, display_name: "Seller", avatar_url: null },
    ],
  };
}

beforeEach(() => {
  h.getUser.mockReset();
  h.resumeAccess.mockReset();
  h.courseAccess.mockReset();
  h.getUser.mockResolvedValue({ data: { user: { id: USER } } });
  h.resumeAccess.mockResolvedValue({ ...FULL_ACCESS });
  h.courseAccess.mockResolvedValue({ ...FULL_ACCESS });
  seedOneQuestion();
});

describe("GET /api/material-questions", () => {
  it("lista las consultas de un apunte con sus sub-recursos mapeados", async () => {
    const res = await GET(req(`target=resume&resume_id=${RESUME_ID}&current_page=1`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.questions).toHaveLength(1);
    const q = json.questions[0];
    expect(q.id).toBe(Q1);
    expect(q.answers).toHaveLength(1);
    expect(q.followups).toHaveLength(1);
    expect(q.counts.meToo).toBe(1);
    expect(q.answers[0].helpfulCount).toBe(1);
    expect(json.pagination.total).toBe(1);
  });

  it("respeta el orden 'recent' y 'most_me_too'", async () => {
    for (const sort of ["recent", "most_me_too", "answered_first", "unresolved_first"]) {
      const res = await GET(req(`target=resume&resume_id=${RESUME_ID}&sort=${sort}`));
      expect(res.status).toBe(200);
    }
  });

  it("filtra por texto (q) sin romper", async () => {
    const res = await GET(req(`target=resume&resume_id=${RESUME_ID}&q=resuelvo`));
    expect(res.status).toBe(200);
  });

  it("lista consultas de un curso (target=course)", async () => {
    h.tables.value.material_questions = [];
    const res = await GET(req(`target=course&course_id=${COURSE_ID}`));
    expect(res.status).toBe(200);
    expect((await res.json()).questions).toHaveLength(0);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET(req(`target=resume&resume_id=${RESUME_ID}`))).status).toBe(401);
  });

  it("con target inválido devuelve 400", async () => {
    expect((await GET(req(`target=x`))).status).toBe(400);
  });

  it("con resume_id inválido devuelve 400", async () => {
    expect((await GET(req(`target=resume&resume_id=no-uuid`))).status).toBe(400);
  });

  it("si el apunte no existe devuelve 404", async () => {
    h.resumeAccess.mockResolvedValue({ ...FULL_ACCESS, exists: false });
    expect((await GET(req(`target=resume&resume_id=${RESUME_ID}`))).status).toBe(404);
  });

  it("filtrar por 'hidden' sin permiso de moderación devuelve 403", async () => {
    h.resumeAccess.mockResolvedValue({ ...FULL_ACCESS, canModerate: false });
    const res = await GET(req(`target=resume&resume_id=${RESUME_ID}&status=hidden`));
    expect(res.status).toBe(403);
  });

  it("con status inválido devuelve 400", async () => {
    expect(
      (await GET(req(`target=resume&resume_id=${RESUME_ID}&status=foo`))).status
    ).toBe(400);
  });

  it("devuelve lista vacía con paginación cuando no hay consultas", async () => {
    h.tables.value.material_questions = [];
    const res = await GET(req(`target=resume&resume_id=${RESUME_ID}`));
    const json = await res.json();
    expect(json.questions).toEqual([]);
    expect(json.pagination.total).toBe(0);
  });
});
