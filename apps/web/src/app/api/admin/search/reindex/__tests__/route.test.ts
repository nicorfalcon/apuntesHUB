import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  configured: true as boolean,
  indexResumeInSearch: vi.fn(),
  removeResumeFromSearch: vi.fn(),
  reindexPublishedResumes: vi.fn(),
  backfillResumeTopicsFromChunks: vi.fn(),
  backfillAllPublishedResumesTopics: vi.fn(),
  getUser: vi.fn(),
  resumeMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/search/meilisearch", () => ({
  isMeilisearchConfigured: () => h.configured,
  indexResumeInSearch: h.indexResumeInSearch,
  removeResumeFromSearch: h.removeResumeFromSearch,
  reindexPublishedResumes: h.reindexPublishedResumes,
}));

vi.mock("@/lib/resumes/backfill-topics", () => ({
  backfillResumeTopicsFromChunks: h.backfillResumeTopicsFromChunks,
  backfillAllPublishedResumesTopics: h.backfillAllPublishedResumesTopics,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: h.resumeMaybeSingle }),
      }),
    }),
  }),
}));

import { POST } from "../route";

const SECRET = "super-secret-token";

function makeRequest(
  body: Record<string, unknown>,
  authorization?: string
): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authorization) headers.authorization = authorization;
  return new NextRequest("http://localhost/api/admin/search/reindex", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

let infoSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  h.configured = true;
  h.indexResumeInSearch.mockResolvedValue({ status: "indexed" });
  h.removeResumeFromSearch.mockResolvedValue(undefined);
  h.reindexPublishedResumes.mockResolvedValue({
    configured: true,
    total: 2,
    indexed: 2,
    batches: 1,
  });
  h.backfillResumeTopicsFromChunks.mockResolvedValue({
    status: "updated",
    added: 2,
  });
  h.backfillAllPublishedResumesTopics.mockResolvedValue({
    total: 3,
    updated: 2,
    unchanged: 1,
  });
  h.getUser.mockResolvedValue({ data: { user: { id: "seller-1" } } });
  h.resumeMaybeSingle.mockResolvedValue({
    data: { id: "r1", seller_id: "seller-1" },
    error: null,
  });
  process.env.MEILISEARCH_ADMIN_SECRET = SECRET;
});

afterEach(() => {
  infoSpy.mockRestore();
  warnSpy.mockRestore();
  process.env = { ...ORIGINAL_ENV };
});

describe("POST /api/admin/search/reindex", () => {
  it("503 si Meilisearch no está configurado", async () => {
    h.configured = false;
    const res = await POST(makeRequest({ action: "reindex-all" }, `Bearer ${SECRET}`));
    expect(res.status).toBe(503);
    expect(h.reindexPublishedResumes).not.toHaveBeenCalled();
  });

  describe("reindex-all", () => {
    it("403 si MEILISEARCH_ADMIN_SECRET no está configurado (no queda abierto)", async () => {
      delete process.env.MEILISEARCH_ADMIN_SECRET;
      const res = await POST(
        makeRequest({ action: "reindex-all" }, `Bearer ${SECRET}`)
      );
      expect(res.status).toBe(403);
      expect(h.reindexPublishedResumes).not.toHaveBeenCalled();
    });

    it("403 sin header Authorization", async () => {
      const res = await POST(makeRequest({ action: "reindex-all" }));
      expect(res.status).toBe(403);
      expect(h.reindexPublishedResumes).not.toHaveBeenCalled();
    });

    it("403 con secret inválido", async () => {
      const res = await POST(
        makeRequest({ action: "reindex-all" }, "Bearer wrong-secret")
      );
      expect(res.status).toBe(403);
      expect(h.reindexPublishedResumes).not.toHaveBeenCalled();
    });

    it("con secret válido llama a reindexPublishedResumes y devuelve el resumen", async () => {
      const res = await POST(
        makeRequest({ action: "reindex-all" }, `Bearer ${SECRET}`)
      );
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(h.reindexPublishedResumes).toHaveBeenCalledTimes(1);
      expect(body).toMatchObject({ ok: true, total: 2, indexed: 2, batches: 1 });
    });

    it("500 si reindexPublishedResumes lanza (mensaje seguro, sin detalle)", async () => {
      h.reindexPublishedResumes.mockRejectedValue(new Error("boom interno"));
      const res = await POST(
        makeRequest({ action: "reindex-all" }, `Bearer ${SECRET}`)
      );
      const body = await res.json();
      expect(res.status).toBe(500);
      expect(body.error).toBe("Falló el reindexado");
      expect(JSON.stringify(body)).not.toContain("boom interno");
    });
  });

  describe("index puntual", () => {
    it("400 si falta resumeId", async () => {
      const res = await POST(makeRequest({ action: "index" }));
      expect(res.status).toBe(400);
      expect(h.indexResumeInSearch).not.toHaveBeenCalled();
    });

    it("401 si no hay usuario autenticado ni secret", async () => {
      h.getUser.mockResolvedValue({ data: { user: null } });
      const res = await POST(makeRequest({ resumeId: "r1" }));
      expect(res.status).toBe(401);
      expect(h.indexResumeInSearch).not.toHaveBeenCalled();
    });

    it("403 si el usuario es un seller ajeno", async () => {
      h.getUser.mockResolvedValue({ data: { user: { id: "otro" } } });
      const res = await POST(makeRequest({ resumeId: "r1" }));
      expect(res.status).toBe(403);
      expect(h.indexResumeInSearch).not.toHaveBeenCalled();
    });

    it("404 si el apunte no existe", async () => {
      h.resumeMaybeSingle.mockResolvedValue({ data: null, error: null });
      const res = await POST(makeRequest({ resumeId: "r1" }));
      expect(res.status).toBe(404);
      expect(h.indexResumeInSearch).not.toHaveBeenCalled();
    });

    it("seller dueño autenticado → llama a indexResumeInSearch", async () => {
      const res = await POST(makeRequest({ resumeId: "r1", action: "index" }));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(h.indexResumeInSearch).toHaveBeenCalledWith("r1");
      expect(body).toMatchObject({ ok: true, status: "indexed" });
    });

    it("seller dueño autenticado no necesita MEILISEARCH_ADMIN_SECRET", async () => {
      delete process.env.MEILISEARCH_ADMIN_SECRET;
      const res = await POST(makeRequest({ resumeId: "r1" }));
      expect(res.status).toBe(200);
      expect(h.indexResumeInSearch).toHaveBeenCalledWith("r1");
    });

    it("default action es 'index' cuando no se especifica", async () => {
      const res = await POST(makeRequest({ resumeId: "r1" }));
      expect(res.status).toBe(200);
      expect(h.indexResumeInSearch).toHaveBeenCalledWith("r1");
    });

    it("con secret válido no requiere validar seller (no consulta Supabase)", async () => {
      const res = await POST(
        makeRequest({ resumeId: "r1", action: "index" }, `Bearer ${SECRET}`)
      );
      expect(res.status).toBe(200);
      expect(h.getUser).not.toHaveBeenCalled();
      expect(h.indexResumeInSearch).toHaveBeenCalledWith("r1");
    });

    it("500 si falla el index puntual (mensaje seguro, sin detalle)", async () => {
      h.indexResumeInSearch.mockRejectedValue(new Error("meili internal boom"));
      const res = await POST(makeRequest({ resumeId: "r1" }));
      const body = await res.json();
      expect(res.status).toBe(500);
      expect(body.error).toBe("Falló la operación de búsqueda");
      expect(JSON.stringify(body)).not.toContain("meili internal boom");
      expect(warnSpy).toHaveBeenCalledWith(
        "[admin:search] operation failed",
        expect.objectContaining({
          resumeId: "r1",
          action: "index",
          message: "meili internal boom",
        })
      );
    });
  });

  describe("backfill-topics masivo", () => {
    it("403 sin secret admin", async () => {
      const res = await POST(makeRequest({ action: "backfill-topics" }));
      expect(res.status).toBe(403);
      expect(h.backfillAllPublishedResumesTopics).not.toHaveBeenCalled();
    });

    it("con secret válido completa topics de todos y reindexa", async () => {
      const res = await POST(
        makeRequest({ action: "backfill-topics" }, `Bearer ${SECRET}`)
      );
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(h.backfillAllPublishedResumesTopics).toHaveBeenCalledTimes(1);
      expect(h.reindexPublishedResumes).toHaveBeenCalledTimes(1);
      expect(body).toMatchObject({
        ok: true,
        backfill: { total: 3, updated: 2, unchanged: 1 },
        reindex: { indexed: 2 },
      });
    });

    it("500 si el backfill masivo lanza (mensaje seguro)", async () => {
      h.backfillAllPublishedResumesTopics.mockRejectedValue(
        new Error("backfill boom interno")
      );
      const res = await POST(
        makeRequest({ action: "backfill-topics" }, `Bearer ${SECRET}`)
      );
      const body = await res.json();
      expect(res.status).toBe(500);
      expect(body.error).toBe("Falló el backfill de temas");
      expect(JSON.stringify(body)).not.toContain("backfill boom interno");
    });
  });

  describe("backfill-topics puntual", () => {
    it("seller dueño → completa topics del apunte y lo reindexa", async () => {
      const res = await POST(
        makeRequest({ resumeId: "r1", action: "backfill-topics" })
      );
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(h.backfillResumeTopicsFromChunks).toHaveBeenCalledWith("r1");
      expect(h.indexResumeInSearch).toHaveBeenCalledWith("r1");
      // No dispara el camino masivo.
      expect(h.backfillAllPublishedResumesTopics).not.toHaveBeenCalled();
      expect(body).toMatchObject({
        ok: true,
        topics: { status: "updated", added: 2 },
        index: { status: "indexed" },
      });
    });

    it("403 si un seller ajeno intenta el backfill puntual", async () => {
      h.getUser.mockResolvedValue({ data: { user: { id: "otro" } } });
      const res = await POST(
        makeRequest({ resumeId: "r1", action: "backfill-topics" })
      );
      expect(res.status).toBe(403);
      expect(h.backfillResumeTopicsFromChunks).not.toHaveBeenCalled();
    });
  });

  describe("remove puntual", () => {
    it("seller dueño → llama a removeResumeFromSearch", async () => {
      const res = await POST(makeRequest({ resumeId: "r1", action: "remove" }));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(h.removeResumeFromSearch).toHaveBeenCalledWith("r1");
      expect(body).toMatchObject({ ok: true, status: "removed" });
    });

    it("con secret válido permite remover sin validar seller", async () => {
      const res = await POST(
        makeRequest({ resumeId: "r1", action: "remove" }, `Bearer ${SECRET}`)
      );
      expect(res.status).toBe(200);
      expect(h.getUser).not.toHaveBeenCalled();
      expect(h.removeResumeFromSearch).toHaveBeenCalledWith("r1");
    });
  });

  describe("métodos HTTP", () => {
    it("no exporta GET (método no permitido)", async () => {
      const mod = await import("../route");
      expect((mod as Record<string, unknown>).GET).toBeUndefined();
      expect(typeof mod.POST).toBe("function");
    });
  });
});
