import { describe, it, expect, beforeEach, vi } from "vitest";

// POST /upload-url: genera la signed URL para que el AUTOR del curso suba el
// video del módulo a Backblaze. Mockeamos Backblaze y la fila course_modules
// (con su recorded_courses) para validar permisos y validaciones de archivo.
// Las funciones puras de config (tipos/extensión) corren de verdad.

const COURSE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MODULE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AUTHOR_ID = "author-1";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  moduleSingle: vi.fn(),
  createUploadUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/backblaze/client", () => ({
  createCourseVideoUploadUrl: h.createUploadUrl,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.single = h.moduleSingle;
      return chain;
    },
  }),
}));

import { POST } from "../route";

function makeRequest(body: unknown) {
  const req = new Request(
    `http://localhost/api/courses/${COURSE_ID}/modules/${MODULE_ID}/upload-url`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  ) as unknown as Parameters<typeof POST>[0];
  return { req, params: Promise.resolve({ id: COURSE_ID, moduleId: MODULE_ID }) };
}

const VALID_BODY = {
  file_name: "clase.mp4",
  content_type: "video/mp4",
  size: 50 * 1024 * 1024,
};

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  h.getUser.mockResolvedValue({ data: { user: { id: AUTHOR_ID } } });
  h.moduleSingle.mockResolvedValue({
    data: { id: MODULE_ID, recorded_courses: { id: COURSE_ID, author_id: AUTHOR_ID } },
    error: null,
  });
  h.createUploadUrl.mockResolvedValue("https://b2.test/signed-upload");
});

describe("POST upload-url", () => {
  it("dado el autor con un video válido, devuelve la signed URL y el storage key", async () => {
    const { req, params } = makeRequest(VALID_BODY);
    const res = await POST(req, { params });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.upload_url).toBe("https://b2.test/signed-upload");
    // El storage key vive bajo la ruta del módulo y conserva la extensión.
    expect(json.storage_key).toMatch(
      new RegExp(`^courses/${COURSE_ID}/modules/${MODULE_ID}/[0-9a-f-]+\\.mp4$`)
    );
    expect(json.max_bytes).toBeGreaterThan(0);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const { req, params } = makeRequest(VALID_BODY);
    expect((await POST(req, { params })).status).toBe(401);
  });

  it("con un content_type no permitido devuelve 400", async () => {
    const { req, params } = makeRequest({ ...VALID_BODY, content_type: "application/zip" });
    expect((await POST(req, { params })).status).toBe(400);
  });

  it("con un tamaño que supera el máximo devuelve 400", async () => {
    const { req, params } = makeRequest({ ...VALID_BODY, size: 5 * 1024 * 1024 * 1024 });
    expect((await POST(req, { params })).status).toBe(400);
  });

  it("si el usuario no es el autor del curso devuelve 403", async () => {
    h.moduleSingle.mockResolvedValue({
      data: { id: MODULE_ID, recorded_courses: { id: COURSE_ID, author_id: "otro" } },
      error: null,
    });
    const { req, params } = makeRequest(VALID_BODY);
    expect((await POST(req, { params })).status).toBe(403);
    expect(h.createUploadUrl).not.toHaveBeenCalled();
  });
});
