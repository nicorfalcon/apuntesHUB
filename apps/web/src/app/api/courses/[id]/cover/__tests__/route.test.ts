import { describe, it, expect, beforeEach, vi } from "vitest";

// PATCH /api/courses/[id]/cover: el autor actualiza la portada del curso
// (imagen y/o color hex). Valida formato, permisos y "sin cambios".

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

import { PATCH } from "../route";

function makeReq(body: unknown, raw?: string) {
  return {
    req: new Request(`http://localhost/api/courses/${COURSE_ID}/cover`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }),
    params: Promise.resolve({ id: COURSE_ID }),
  };
}

beforeEach(() => {
  h.getUser.mockReset();
  h.course.value = { id: COURSE_ID, author_id: AUTHOR_ID, deleted_at: null };
  h.updateError.value = null;
  h.getUser.mockResolvedValue({ data: { user: { id: AUTHOR_ID } } });
});

describe("PATCH courses/[id]/cover", () => {
  it("actualiza color y/o imagen (200)", async () => {
    const { req, params } = makeReq({ cover_color: "#1a2b3c" });
    expect((await PATCH(req, { params })).status).toBe(200);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const { req, params } = makeReq({ cover_color: "#1a2b3c" });
    expect((await PATCH(req, { params })).status).toBe(401);
  });

  it("con body no-JSON devuelve 400", async () => {
    const { req, params } = makeReq(null, "no-json");
    expect((await PATCH(req, { params })).status).toBe(400);
  });

  it("con color hex inválido devuelve 400", async () => {
    const { req, params } = makeReq({ cover_color: "rojo" });
    expect((await PATCH(req, { params })).status).toBe(400);
  });

  it("con URL de portada demasiado larga devuelve 400", async () => {
    const { req, params } = makeReq({ cover_image_url: "https://x/" + "a".repeat(2048) });
    expect((await PATCH(req, { params })).status).toBe(400);
  });

  it("si no es el autor devuelve 403", async () => {
    h.course.value = { id: COURSE_ID, author_id: "otro", deleted_at: null };
    const { req, params } = makeReq({ cover_color: "#1a2b3c" });
    expect((await PATCH(req, { params })).status).toBe(403);
  });

  it("si el curso está eliminado devuelve 400", async () => {
    h.course.value = { id: COURSE_ID, author_id: AUTHOR_ID, deleted_at: "2026-01-01" };
    const { req, params } = makeReq({ cover_color: "#1a2b3c" });
    expect((await PATCH(req, { params })).status).toBe(400);
  });

  it("sin cambios para guardar devuelve 400", async () => {
    const { req, params } = makeReq({});
    expect((await PATCH(req, { params })).status).toBe(400);
  });

  it("si falla el update devuelve 500", async () => {
    h.updateError.value = { message: "db" };
    const { req, params } = makeReq({ cover_color: "#1a2b3c" });
    expect((await PATCH(req, { params })).status).toBe(500);
  });
});
