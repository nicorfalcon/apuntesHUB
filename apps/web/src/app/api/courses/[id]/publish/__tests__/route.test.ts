import { describe, it, expect, beforeEach, vi } from "vitest";

// POST /api/courses/[id]/publish: el autor publica su curso. Requiere que cada
// módulo tenga video cargado y que el curso no esté eliminado.

const COURSE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const AUTHOR_ID = "author-1";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  course: { value: null as Record<string, unknown> | null },
  updateError: { value: null as { message: string } | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.update = () => c;
      c.eq = () => c;
      c.single = async () => ({ data: h.course.value });
      c.then = (r: (v: unknown) => void) => r({ error: h.updateError.value });
      return c;
    },
  }),
}));

import { POST } from "../route";

function makeReq() {
  return {
    req: new Request(`http://localhost/api/courses/${COURSE_ID}/publish`, { method: "POST" }),
    params: Promise.resolve({ id: COURSE_ID }),
  };
}

function course(overrides: Record<string, unknown> = {}) {
  return {
    id: COURSE_ID,
    author_id: AUTHOR_ID,
    deleted_at: null,
    course_modules: [{ id: "m1", video_storage_key: "courses/x/v.mp4" }],
    ...overrides,
  };
}

beforeEach(() => {
  h.getUser.mockReset();
  h.course.value = course();
  h.updateError.value = null;
  h.getUser.mockResolvedValue({ data: { user: { id: AUTHOR_ID } } });
});

describe("POST courses/[id]/publish", () => {
  it("publica el curso con módulos completos (200)", async () => {
    const { req, params } = makeReq();
    expect((await POST(req, { params })).status).toBe(200);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const { req, params } = makeReq();
    expect((await POST(req, { params })).status).toBe(401);
  });

  it("si no es el autor devuelve 403", async () => {
    h.course.value = course({ author_id: "otro" });
    const { req, params } = makeReq();
    expect((await POST(req, { params })).status).toBe(403);
  });

  it("si el curso está eliminado devuelve 400", async () => {
    h.course.value = course({ deleted_at: "2026-01-01" });
    const { req, params } = makeReq();
    expect((await POST(req, { params })).status).toBe(400);
  });

  it("si algún módulo no tiene video devuelve 400", async () => {
    h.course.value = course({
      course_modules: [{ id: "m1", video_storage_key: null }],
    });
    const { req, params } = makeReq();
    expect((await POST(req, { params })).status).toBe(400);
  });

  it("sin módulos devuelve 400", async () => {
    h.course.value = course({ course_modules: [] });
    const { req, params } = makeReq();
    expect((await POST(req, { params })).status).toBe(400);
  });

  it("si falla el update devuelve 500", async () => {
    h.updateError.value = { message: "db" };
    const { req, params } = makeReq();
    expect((await POST(req, { params })).status).toBe(500);
  });
});
