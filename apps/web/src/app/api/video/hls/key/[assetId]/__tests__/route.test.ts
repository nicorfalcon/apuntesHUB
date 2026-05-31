import { describe, it, expect, beforeEach, vi } from "vitest";

// Tests del endpoint que entrega la key AES-128 del HLS encriptado. Es el más
// sensible: solo compradores/autores con acceso deben poder bajarla, y la key
// debe medir exactamente 16 bytes. Mockeamos Backblaze y las filas para validar
// la lógica sin un video real ni el worker.

const ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MODULE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const COURSE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VIDEO_KEY = "courses/curso/original.mp4";

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

function makeRequest(assetId = ASSET_ID) {
  const req = new Request(`http://localhost/api/video/hls/key/${assetId}`);
  return { req, params: Promise.resolve({ assetId }) };
}

const READY_ASSET = {
  id: ASSET_ID,
  module_id: MODULE_ID,
  hls_key_storage_key: "courses/curso/hls/enc.key",
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
  // Key AES-128 válida: 16 bytes.
  h.readBytes.mockResolvedValue(new Uint8Array(16).fill(7));
});

describe("GET hls/key", () => {
  it("entrega la key de 16 bytes como octet-stream", async () => {
    const { req, params } = makeRequest();
    const res = await GET(req, { params });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.byteLength).toBe(16);
    expect(h.readBytes).toHaveBeenCalledWith(READY_ASSET.hls_key_storage_key);
  });

  it("si la key no mide 16 bytes devuelve 500", async () => {
    h.readBytes.mockResolvedValue(new Uint8Array(8));
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(500);
  });

  it("con assetId inválido devuelve 400", async () => {
    const { req, params } = makeRequest("no-uuid");
    const res = await GET(req, { params });
    expect(res.status).toBe(400);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
  });

  it("si el asset no existe o no está listo devuelve 404", async () => {
    h.assetMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  it("para un comprador cuyo video no coincide devuelve 403", async () => {
    h.assetMaybeSingle.mockResolvedValue({
      data: { ...READY_ASSET, original_video_storage_key: "otro.mp4" },
      error: null,
    });
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(403);
  });

  it("si no puede leer la key de Backblaze devuelve 502", async () => {
    h.readBytes.mockRejectedValue(new Error("b2 down"));
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(502);
  });
});
