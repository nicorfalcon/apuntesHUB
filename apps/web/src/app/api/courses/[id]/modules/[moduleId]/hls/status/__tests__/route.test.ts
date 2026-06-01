import { describe, it, expect, beforeEach, vi } from "vitest";

// GET /hls/status: lo pollea el player mientras el video se procesa. Mockeamos
// acceso y course_video_assets para validar la selección del asset relevante,
// la normalización de stage/progress y los mensajes.

const COURSE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MODULE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const VIDEO_KEY = "courses/curso/original.mp4";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  assertAccess: vi.fn(),
  assetsOrder: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.in = () => chain;
      chain.order = h.assetsOrder;
      return chain;
    },
  }),
}));

vi.mock("@/lib/courses/access", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/courses/access")>();
  return { ...actual, assertCourseModuleAccess: h.assertAccess };
});

import { GET } from "../route";

const params = Promise.resolve({ id: COURSE_ID, moduleId: MODULE_ID });
const request = new Request("http://localhost/api/courses/c/modules/m/hls/status");

function asset(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset-1",
    processing_status: "processing",
    processing_stage: "transcoding",
    processing_progress: 42,
    is_active: false,
    original_video_storage_key: VIDEO_KEY,
    created_at: "2026-05-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  h.getUser.mockResolvedValue({ data: { user: { id: "buyer-1" } } });
  h.assertAccess.mockResolvedValue({
    isAuthor: false,
    module: { id: MODULE_ID, video_storage_key: VIDEO_KEY },
  });
  h.assetsOrder.mockResolvedValue({ data: [asset()], error: null });
});

describe("GET hls/status", () => {
  it("devuelve el estado en proceso con stage, progress y mensaje", async () => {
    const res = await GET(request, { params });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      status: "processing",
      stage: "transcoding",
      progress: 42,
    });
    expect(json.message).toContain("Convirtiendo el video a HLS");
  });

  it("para un asset ready+activo, normaliza el progress a 100", async () => {
    h.assetsOrder.mockResolvedValue({
      data: [asset({ processing_status: "ready", processing_stage: "ready", is_active: true })],
      error: null,
    });
    const json = await (await GET(request, { params })).json();
    expect(json.status).toBe("ready");
    expect(json.progress).toBe(100);
  });

  it("prioriza el asset ready+activo por sobre otros estados", async () => {
    h.assetsOrder.mockResolvedValue({
      data: [
        asset({ id: "fail", processing_status: "failed", is_active: false }),
        asset({ id: "ready", processing_status: "ready", processing_stage: "ready", is_active: true }),
      ],
      error: null,
    });
    const json = await (await GET(request, { params })).json();
    expect(json.status).toBe("ready");
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET(request, { params })).status).toBe(401);
  });

  it("si el módulo no tiene video devuelve 404", async () => {
    h.assertAccess.mockResolvedValue({
      isAuthor: false,
      module: { id: MODULE_ID, video_storage_key: null },
    });
    expect((await GET(request, { params })).status).toBe(404);
  });

  it("si la query falla devuelve 500", async () => {
    h.assetsOrder.mockResolvedValue({ data: null, error: { message: "db" } });
    expect((await GET(request, { params })).status).toBe(500);
  });

  it("si no hay assets relevantes devuelve 404", async () => {
    h.assetsOrder.mockResolvedValue({ data: [], error: null });
    expect((await GET(request, { params })).status).toBe(404);
  });
});
