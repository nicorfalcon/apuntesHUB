import { describe, it, expect, beforeEach, vi } from "vitest";

// GET /api/pdf/[id]/preview: imágenes de la vista previa protegida. Público, pero
// solo de apuntes publicados y con preview 'ready'.

const ID = "11111111-1111-4111-8111-111111111111";

const h = vi.hoisted(() => ({
  resume: vi.fn(), // resultado de resumes...maybeSingle()
  pages: vi.fn(), // resultado de resume_preview_pages...order()
  createSignedUrls: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = () => c;
      c.order = () => h.pages();
      c.maybeSingle = () => h.resume();
      void table;
      return c;
    },
    storage: {
      from: () => ({ createSignedUrls: h.createSignedUrls }),
    },
  }),
}));

import { GET } from "../route";

function makeReq(id = ID) {
  return {
    req: new Request(
      `http://localhost/api/pdf/${id}/preview`
    ) as unknown as Parameters<typeof GET>[0],
    ctx: { params: { id } },
  };
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
});

describe("GET /api/pdf/[id]/preview", () => {
  it("404 si el apunte no existe", async () => {
    h.resume.mockResolvedValue({ data: null, error: null });
    const { req, ctx } = makeReq();
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("404 si el apunte no está publicado", async () => {
    h.resume.mockResolvedValue({
      data: { id: ID, status: "draft", deleted_at: null, preview_status: "ready" },
      error: null,
    });
    const { req, ctx } = makeReq();
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("404 si el apunte fue borrado (soft-delete) aunque siga 'published'", async () => {
    h.resume.mockResolvedValue({
      data: {
        id: ID,
        status: "published",
        deleted_at: "2026-06-01T00:00:00.000Z",
        preview_status: "ready",
      },
      error: null,
    });
    const { req, ctx } = makeReq();
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("devuelve status y pages vacío si la preview aún no está lista", async () => {
    h.resume.mockResolvedValue({
      data: { id: ID, status: "published", deleted_at: null, preview_status: "pending" },
      error: null,
    });
    const { req, ctx } = makeReq();
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "pending", pageCount: 0, pages: [] });
  });

  it("devuelve páginas firmadas con el flag locked correcto", async () => {
    h.resume.mockResolvedValue({
      data: {
        id: ID,
        status: "published",
        deleted_at: null,
        preview_status: "ready",
        preview_page_count: 2,
      },
      error: null,
    });
    h.pages.mockResolvedValue({
      data: [
        { page_number: 1, storage_path: "s/r/p1.png", is_locked: false, width: 1200, height: 1600 },
        { page_number: 3, storage_path: "s/r/p3.png", is_locked: true, width: 480, height: 640 },
      ],
      error: null,
    });
    h.createSignedUrls.mockResolvedValue({
      data: [
        { path: "s/r/p1.png", signedUrl: "https://signed/p1" },
        { path: "s/r/p3.png", signedUrl: "https://signed/p3" },
      ],
      error: null,
    });

    const { req, ctx } = makeReq();
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.status).toBe("ready");
    expect(body.pageCount).toBe(2);
    expect(body.pages).toEqual([
      { page: 1, url: "https://signed/p1", locked: false, w: 1200, h: 1600 },
      { page: 3, url: "https://signed/p3", locked: true, w: 480, h: 640 },
    ]);
  });
});
