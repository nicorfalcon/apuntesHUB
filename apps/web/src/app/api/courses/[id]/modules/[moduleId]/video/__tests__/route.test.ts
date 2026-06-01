import { describe, it, expect, beforeEach, vi } from "vitest";

// POST /video: confirma una subida terminada. Valida prefijo del storage key,
// permisos de autor, metadata real del objeto (tamaño/tipo) y, en el camino
// feliz, persiste el video y encola el asset HLS (insert pending). Mockeamos
// Backblaze y el admin client con un builder flexible.

const COURSE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MODULE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AUTHOR_ID = "author-1";
const STORAGE_KEY = `courses/${COURSE_ID}/modules/${MODULE_ID}/abc123.mp4`;

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  metadata: vi.fn(),
  deleteVideo: vi.fn(),
  module: { value: null as unknown },
  assets: { value: [] as unknown[] },
  insert: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/backblaze/client", () => ({
  getCourseVideoMetadata: h.metadata,
  deleteCourseVideo: h.deleteVideo,
}));

vi.mock("@/lib/supabase/admin", () => {
  // Builder encadenable y "thenable": resuelve un valor terminal cuando se hace
  // await sobre la cadena (p.ej. update().eq().eq() o select().eq()).
  function builder(
    resolveValue: unknown,
    extra: { single?: () => Promise<unknown>; insert?: () => Promise<unknown> }
  ) {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.in = () => chain;
    chain.update = () => chain;
    chain.single = extra.single ?? (async () => ({ data: null, error: null }));
    chain.insert = extra.insert ?? (async () => ({ error: null }));
    chain.then = (resolve: (v: unknown) => void) => resolve(resolveValue);
    return chain;
  }
  return {
    createAdminClient: () => ({
      from: (table: string) =>
        table === "course_modules"
          ? builder(
              { error: null },
              { single: async () => ({ data: h.module.value, error: null }) }
            )
          : builder(
              { data: h.assets.value, error: null },
              { insert: h.insert }
            ),
    }),
  };
});

import { POST } from "../route";

function makeRequest(body: unknown) {
  const req = new Request(
    `http://localhost/api/courses/${COURSE_ID}/modules/${MODULE_ID}/video`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  ) as unknown as Parameters<typeof POST>[0];
  return { req, params: Promise.resolve({ id: COURSE_ID, moduleId: MODULE_ID }) };
}

beforeEach(() => {
  h.getUser.mockReset();
  h.metadata.mockReset();
  h.deleteVideo.mockReset();
  h.insert.mockReset();
  h.getUser.mockResolvedValue({ data: { user: { id: AUTHOR_ID } } });
  h.module.value = {
    id: MODULE_ID,
    video_storage_key: null,
    recorded_courses: { id: COURSE_ID, author_id: AUTHOR_ID },
  };
  h.assets.value = [];
  h.metadata.mockResolvedValue({ ContentLength: 1000, ContentType: "video/mp4" });
  h.deleteVideo.mockResolvedValue(undefined);
  h.insert.mockResolvedValue({ error: null });
});

describe("POST video (confirmar subida)", () => {
  it("dado el autor y metadata válida, persiste el video y encola el asset HLS", async () => {
    const { req, params } = makeRequest({ storage_key: STORAGE_KEY });
    const res = await POST(req, { params });

    expect(res.status).toBe(200);
    expect((await res.json())).toMatchObject({ ok: true, storage_key: STORAGE_KEY });
    // Encola el HLS: inserta una fila pending en course_video_assets.
    expect(h.insert).toHaveBeenCalledTimes(1);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const { req, params } = makeRequest({ storage_key: STORAGE_KEY });
    expect((await POST(req, { params })).status).toBe(401);
  });

  it("con un storage_key que no respeta el prefijo del módulo devuelve 400", async () => {
    const { req, params } = makeRequest({ storage_key: "courses/otro/modules/x/v.mp4" });
    expect((await POST(req, { params })).status).toBe(400);
  });

  it("si el usuario no es el autor devuelve 403", async () => {
    h.module.value = {
      id: MODULE_ID,
      video_storage_key: null,
      recorded_courses: { id: COURSE_ID, author_id: "otro" },
    };
    const { req, params } = makeRequest({ storage_key: STORAGE_KEY });
    expect((await POST(req, { params })).status).toBe(403);
  });

  it("si no encuentra el objeto subido (metadata falla) devuelve 400", async () => {
    h.metadata.mockRejectedValue(new Error("not found"));
    const { req, params } = makeRequest({ storage_key: STORAGE_KEY });
    expect((await POST(req, { params })).status).toBe(400);
  });

  it("si el objeto supera el tamaño máximo devuelve 400 y lo borra", async () => {
    h.metadata.mockResolvedValue({
      ContentLength: 5 * 1024 * 1024 * 1024,
      ContentType: "video/mp4",
    });
    const { req, params } = makeRequest({ storage_key: STORAGE_KEY });
    expect((await POST(req, { params })).status).toBe(400);
    expect(h.deleteVideo).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it("si el objeto no es un tipo de video permitido devuelve 400 y lo borra", async () => {
    h.metadata.mockResolvedValue({ ContentLength: 1000, ContentType: "application/zip" });
    const { req, params } = makeRequest({ storage_key: STORAGE_KEY });
    expect((await POST(req, { params })).status).toBe(400);
    expect(h.deleteVideo).toHaveBeenCalledWith(STORAGE_KEY);
  });
});
