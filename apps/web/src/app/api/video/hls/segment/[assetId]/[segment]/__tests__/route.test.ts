import { describe, it, expect, beforeEach, vi } from "vitest";

// Tests del endpoint que sirve un segmento HLS (.ts) ya procesado. Mockeamos
// Backblaze y las filas course_video_assets / course_modules para validar la
// derivación del storage key del segmento y el control de acceso, sin depender
// de un video real ni del worker de procesamiento.

const ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MODULE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const COURSE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VIDEO_KEY = "courses/curso/original.mp4";
const SEGMENT_PREFIX = "courses/curso/hls/segment_";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  assertAccess: vi.fn(),
  readBytes: vi.fn(),
  assetMaybeSingle: vi.fn(),
  moduleMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/backblaze/client", () => ({
  readPrivateObjectBytes: h.readBytes,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle =
        table === "course_video_assets"
          ? h.assetMaybeSingle
          : h.moduleMaybeSingle;
      return chain;
    },
  }),
}));

vi.mock("@/lib/courses/access", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/courses/access")>();
  return { ...actual, assertCourseModuleAccess: h.assertAccess };
});

import { GET } from "../route";
import { CourseModuleAccessError } from "@/lib/courses/access";

function makeRequest(assetId = ASSET_ID, segment = "segment_3.ts") {
  const req = new Request(
    `http://localhost/api/video/hls/segment/${assetId}/${segment}`
  );
  return {
    req,
    params: Promise.resolve({ assetId, segment }),
  };
}

const READY_ASSET = {
  id: ASSET_ID,
  module_id: MODULE_ID,
  hls_segment_prefix: SEGMENT_PREFIX,
  original_video_storage_key: VIDEO_KEY,
  processing_status: "ready",
  is_active: true,
};

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  h.getUser.mockResolvedValue({ data: { user: { id: "buyer-1" } } });
  h.assertAccess.mockResolvedValue({
    isAuthor: false,
    module: { video_storage_key: VIDEO_KEY },
  });
  h.assetMaybeSingle.mockResolvedValue({ data: READY_ASSET, error: null });
  h.moduleMaybeSingle.mockResolvedValue({
    data: { id: MODULE_ID, course_id: COURSE_ID, video_storage_key: VIDEO_KEY },
    error: null,
  });
  h.readBytes.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
});

describe("GET hls/segment", () => {
  it("sirve el segmento y deriva el storage key desde el prefix del asset", async () => {
    const { req, params } = makeRequest(ASSET_ID, "segment_3.ts");
    const res = await GET(req, { params });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("video/mp2t");
    // segment_3.ts + prefix ".../segment_" => ".../3.ts"
    expect(h.readBytes).toHaveBeenCalledWith(`${SEGMENT_PREFIX}3.ts`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  });

  it("con assetId inválido devuelve 400", async () => {
    const { req, params } = makeRequest("no-uuid", "segment_3.ts");
    const res = await GET(req, { params });
    expect(res.status).toBe(400);
  });

  it("con un nombre de segmento que no matchea el patrón devuelve 400", async () => {
    const { req, params } = makeRequest(ASSET_ID, "evil.ts");
    const res = await GET(req, { params });
    expect(res.status).toBe(400);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
  });

  it("si el asset no está listo devuelve 404", async () => {
    h.assetMaybeSingle.mockResolvedValue({
      data: { ...READY_ASSET, processing_status: "processing" },
      error: null,
    });
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  it("para un comprador cuyo video no coincide devuelve 403", async () => {
    h.assertAccess.mockResolvedValue({
      isAuthor: false,
      module: { video_storage_key: VIDEO_KEY },
    });
    h.moduleMaybeSingle.mockResolvedValue({
      data: { id: MODULE_ID, course_id: COURSE_ID, video_storage_key: VIDEO_KEY },
      error: null,
    });
    h.assetMaybeSingle.mockResolvedValue({
      data: { ...READY_ASSET, original_video_storage_key: "otro.mp4" },
      error: null,
    });
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(403);
  });

  it("propaga el código del error de acceso (403)", async () => {
    h.assertAccess.mockRejectedValue(
      new CourseModuleAccessError("forbidden", "Sin acceso")
    );
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(403);
  });

  it("si no puede leer el segmento de Backblaze devuelve 502", async () => {
    h.readBytes.mockRejectedValue(new Error("b2 down"));
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(502);
  });
});
