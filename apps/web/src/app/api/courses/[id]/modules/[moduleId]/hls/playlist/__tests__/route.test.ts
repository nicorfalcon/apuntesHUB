import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Tests del endpoint que sirve la playlist HLS (m3u8). El video real vive en
// Backblaze y se procesa con un worker, así que NO subimos nada: mockeamos la
// lectura de Backblaze y la fila course_video_assets para ejercitar la lógica
// que importa de verdad —reescritura de la playlist (key + segmentos) y control
// de acceso— de forma determinística, como si el video ya estuviera procesado.

const ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MODULE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const COURSE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VIDEO_KEY = "courses/curso/original.mp4";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  assertAccess: vi.fn(),
  readText: vi.fn(),
  assetMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/backblaze/client", () => ({
  readPrivateObjectText: h.readText,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = h.assetMaybeSingle;
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

function makeRequest(query = "") {
  // NextRequest expone nextUrl.searchParams, que el handler usa para ?assetId.
  return new NextRequest(
    `http://localhost/api/courses/${COURSE_ID}/modules/${MODULE_ID}/hls/playlist${query}`
  );
}

const params = Promise.resolve({ id: COURSE_ID, moduleId: MODULE_ID });

const READY_ASSET = {
  id: ASSET_ID,
  module_id: MODULE_ID,
  hls_playlist_storage_key: "courses/curso/hls/playlist.m3u8",
  hls_segment_prefix: "courses/curso/hls/segment_",
  hls_key_storage_key: "courses/curso/hls/enc.key",
  original_video_storage_key: VIDEO_KEY,
  processing_status: "ready",
  is_active: true,
};

const RAW_PLAYLIST = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  '#EXT-X-KEY:METHOD=AES-128,URI="__HLS_KEY_URI__"',
  "#EXTINF:6.0,",
  "segment_0.ts",
  "#EXTINF:6.0,",
  "segment_1.ts",
  "#EXT-X-ENDLIST",
].join("\n");

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  h.getUser.mockResolvedValue({ data: { user: { id: "buyer-1" } } });
  h.assertAccess.mockResolvedValue({
    isAuthor: false,
    module: { video_storage_key: VIDEO_KEY },
  });
  h.assetMaybeSingle.mockResolvedValue({ data: READY_ASSET, error: null });
  h.readText.mockResolvedValue(RAW_PLAYLIST);
});

describe("GET hls/playlist", () => {
  it("dado un asset listo, reescribe la key y los segmentos a endpoints proxy", async () => {
    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain(
      "application/vnd.apple.mpegurl"
    );

    const body = await res.text();
    // La key apunta al endpoint proxy del asset.
    expect(body).toContain(`URI="/api/video/hls/key/${ASSET_ID}"`);
    // Cada segmento se reescribe a su endpoint proxy.
    expect(body).toContain(`/api/video/hls/segment/${ASSET_ID}/segment_0.ts`);
    expect(body).toContain(`/api/video/hls/segment/${ASSET_ID}/segment_1.ts`);
    // El placeholder original ya no está y los comentarios se preservan.
    expect(body).not.toContain("__HLS_KEY_URI__");
    expect(body).toContain("#EXT-X-ENDLIST");
    // Leyó la playlist desde el storage key del asset.
    expect(h.readText).toHaveBeenCalledWith(READY_ASSET.hls_playlist_storage_key);
  });

  it("sin usuario autenticado devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(401);
  });

  it("propaga el código del error de acceso (403)", async () => {
    h.assertAccess.mockRejectedValue(
      new CourseModuleAccessError("forbidden", "Sin acceso")
    );
    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(403);
  });

  it("con un assetId con formato inválido devuelve 400", async () => {
    const res = await GET(makeRequest("?assetId=no-es-uuid"), { params });
    expect(res.status).toBe(400);
  });

  it("si no encuentra el asset listo devuelve 404", async () => {
    h.assetMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(404);
  });

  it("si no puede leer la playlist de Backblaze devuelve 502", async () => {
    h.readText.mockRejectedValue(new Error("b2 down"));
    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(502);
  });

  it("si la playlist no tiene el placeholder de key devuelve 500", async () => {
    h.readText.mockResolvedValue("#EXTM3U\nsegment_0.ts\n");
    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(500);
  });

  it("para un comprador cuyo video no coincide con el asset devuelve 403", async () => {
    h.assertAccess.mockResolvedValue({
      isAuthor: false,
      module: { video_storage_key: "otro-video.mp4" },
    });
    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(403);
  });
});
