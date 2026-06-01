import { describe, it, expect, beforeEach, vi } from "vitest";

// GET /video-url: genera la signed URL de lectura del MP4 (fallback cuando NO
// hay HLS activo). Mockeamos acceso, estado HLS y Backblaze para cubrir las
// reglas: HLS activo bloquea el MP4 a compradores, processing devuelve 409, etc.

const COURSE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MODULE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const VIDEO_KEY = "courses/curso/original.mp4";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  assertAccess: vi.fn(),
  hlsStatus: vi.fn(),
  readUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/backblaze/client", () => ({
  createCourseVideoReadUrl: h.readUrl,
}));

vi.mock("@/lib/courses/hls", () => ({
  getModuleHlsStatus: h.hlsStatus,
}));

vi.mock("@/lib/courses/access", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/courses/access")>();
  return { ...actual, assertCourseModuleAccess: h.assertAccess };
});

import { GET } from "../route";
import { CourseModuleAccessError } from "@/lib/courses/access";

const params = Promise.resolve({ id: COURSE_ID, moduleId: MODULE_ID });
const request = new Request("http://localhost/api/courses/c/modules/m/video-url");

function access(overrides: Record<string, unknown> = {}) {
  return {
    isAuthor: false,
    module: { id: MODULE_ID, video_storage_key: VIDEO_KEY },
    ...overrides,
  };
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  h.getUser.mockResolvedValue({ data: { user: { id: "buyer-1" } } });
  h.assertAccess.mockResolvedValue(access());
  h.hlsStatus.mockResolvedValue({
    hasActiveHlsAsset: false,
    hasPendingOrProcessingHlsAsset: false,
  });
  h.readUrl.mockResolvedValue("https://b2.test/signed-read");
});

describe("GET video-url", () => {
  it("sin HLS activo, devuelve la signed URL del MP4", async () => {
    const res = await GET(request, { params });
    expect(res.status).toBe(200);
    expect((await res.json()).videoUrl).toBe("https://b2.test/signed-read");
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET(request, { params })).status).toBe(401);
  });

  it("propaga el error de acceso (404 not_found)", async () => {
    h.assertAccess.mockRejectedValue(
      new CourseModuleAccessError("not_found", "No existe")
    );
    expect((await GET(request, { params })).status).toBe(404);
  });

  it("si el módulo no tiene video devuelve 404", async () => {
    h.assertAccess.mockResolvedValue(
      access({ module: { id: MODULE_ID, video_storage_key: null } })
    );
    expect((await GET(request, { params })).status).toBe(404);
  });

  it("con HLS activo y comprador (no autor) bloquea el MP4 con 403", async () => {
    h.hlsStatus.mockResolvedValue({
      hasActiveHlsAsset: true,
      hasPendingOrProcessingHlsAsset: false,
    });
    expect((await GET(request, { params })).status).toBe(403);
  });

  it("con HLS en proceso (sin activo) y comprador devuelve 409", async () => {
    h.hlsStatus.mockResolvedValue({
      hasActiveHlsAsset: false,
      hasPendingOrProcessingHlsAsset: true,
    });
    expect((await GET(request, { params })).status).toBe(409);
  });

  it("el autor puede pedir el MP4 aunque haya HLS activo", async () => {
    h.assertAccess.mockResolvedValue(access({ isAuthor: true }));
    h.hlsStatus.mockResolvedValue({
      hasActiveHlsAsset: true,
      hasPendingOrProcessingHlsAsset: false,
    });
    expect((await GET(request, { params })).status).toBe(200);
  });

  it("si Backblaze falla al firmar la URL devuelve 500", async () => {
    h.readUrl.mockRejectedValue(new Error("b2 down"));
    expect((await GET(request, { params })).status).toBe(500);
  });
});
