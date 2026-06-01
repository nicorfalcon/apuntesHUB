import { describe, it, expect, beforeEach, vi } from "vitest";

// POST /api/courses/[id]/progress: upsert del progreso de un módulo. El acceso
// (assertCourseModuleAccess con requireEnrollment) ya está testeado; acá
// validamos la orquestación y la lógica de "completado".

const COURSE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MODULE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  assertAccess: vi.fn(),
  existing: { value: null as { completed_at: string | null } | null },
  upsertError: { value: null as { message: string } | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    from: () => {
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = () => c;
      c.upsert = async () => ({ error: h.upsertError.value });
      c.maybeSingle = async () => ({ data: h.existing.value });
      return c;
    },
  }),
}));

vi.mock("@/lib/courses/access", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/courses/access")>();
  return { ...actual, assertCourseModuleAccess: h.assertAccess };
});

import { POST } from "../route";
import { CourseModuleAccessError } from "@/lib/courses/access";

function makeReq(body: unknown) {
  return {
    req: new Request(`http://localhost/api/courses/${COURSE_ID}/progress`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as Parameters<typeof POST>[0],
    params: Promise.resolve({ id: COURSE_ID }),
  };
}

beforeEach(() => {
  h.getUser.mockReset();
  h.assertAccess.mockReset();
  h.existing.value = null;
  h.upsertError.value = null;
  h.getUser.mockResolvedValue({ data: { user: { id: "buyer-1" } } });
  h.assertAccess.mockResolvedValue({
    enrollmentId: "enr-1",
    module: { id: MODULE_ID, duration_seconds: 600 },
  });
});

describe("POST courses/[id]/progress", () => {
  it("guarda el progreso parcial (no completado)", async () => {
    const { req, params } = makeReq({ module_id: MODULE_ID, watched_seconds: 100 });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect((await res.json()).completed).toBe(false);
  });

  it("marca completado cuando se ve casi todo el módulo", async () => {
    const { req, params } = makeReq({ module_id: MODULE_ID, watched_seconds: 599 });
    const res = await POST(req, { params });
    expect((await res.json()).completed).toBe(true);
  });

  it("marca completado si el body lo indica explícitamente", async () => {
    const { req, params } = makeReq({ module_id: MODULE_ID, watched_seconds: 10, completed: true });
    expect((await (await POST(req, { params })).json()).completed).toBe(true);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const { req, params } = makeReq({ module_id: MODULE_ID });
    expect((await POST(req, { params })).status).toBe(401);
  });

  it("sin module_id devuelve 400", async () => {
    const { req, params } = makeReq({ watched_seconds: 10 });
    expect((await POST(req, { params })).status).toBe(400);
  });

  it("propaga el error de acceso (403 sin inscripción)", async () => {
    h.assertAccess.mockRejectedValue(
      new CourseModuleAccessError("forbidden", "Sin inscripción")
    );
    const { req, params } = makeReq({ module_id: MODULE_ID });
    expect((await POST(req, { params })).status).toBe(403);
  });

  it("si falla el upsert devuelve 500", async () => {
    h.upsertError.value = { message: "db" };
    const { req, params } = makeReq({ module_id: MODULE_ID, watched_seconds: 10 });
    expect((await POST(req, { params })).status).toBe(500);
  });
});
