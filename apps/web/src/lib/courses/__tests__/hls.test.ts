import { describe, it, expect, beforeEach, vi } from "vitest";

// getModuleHlsStatus consulta course_video_assets vía el admin client. Mockeamos
// createAdminClient para devolver filas controladas y verificar cómo la unidad
// las clasifica (activo / pendiente-o-procesando).
const h = vi.hoisted(() => ({ createAdminClient: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: h.createAdminClient,
}));

import { getModuleHlsStatus, hasActiveHlsAsset } from "../hls";

type Row = {
  processing_status: "pending" | "processing" | "ready" | "failed";
  is_active: boolean;
  original_video_storage_key: string | null;
};

function makeAdmin(rows: Row[] | null) {
  // Cadena: from(table).select(...).eq().eq().in() -> { data }
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            in: async () => ({ data: rows }),
          }),
        }),
      }),
    })),
  };
}

describe("getModuleHlsStatus", () => {
  beforeEach(() => {
    h.createAdminClient.mockReset();
  });

  it("dado un storage key nulo, entonces devuelve todo en false sin consultar la DB", async () => {
    const admin = makeAdmin([]);
    h.createAdminClient.mockReturnValue(admin);

    const result = await getModuleHlsStatus("mod-1", null);

    expect(result).toEqual({
      hasActiveHlsAsset: false,
      hasPendingOrProcessingHlsAsset: false,
    });
    // Short-circuit: ni siquiera crea el admin client.
    expect(h.createAdminClient).not.toHaveBeenCalled();
  });

  it("dado un asset ready y activo, entonces hasActiveHlsAsset es true", async () => {
    const admin = makeAdmin([
      { processing_status: "ready", is_active: true, original_video_storage_key: "k" },
    ]);
    h.createAdminClient.mockReturnValue(admin);

    const result = await getModuleHlsStatus("mod-1", "k");

    expect(result.hasActiveHlsAsset).toBe(true);
    expect(result.hasPendingOrProcessingHlsAsset).toBe(false);
  });

  it("dado un asset ready pero inactivo, entonces NO cuenta como activo", async () => {
    const admin = makeAdmin([
      { processing_status: "ready", is_active: false, original_video_storage_key: "k" },
    ]);
    h.createAdminClient.mockReturnValue(admin);

    const result = await getModuleHlsStatus("mod-1", "k");

    expect(result.hasActiveHlsAsset).toBe(false);
  });

  it("dado un asset pending o processing, entonces hasPendingOrProcessingHlsAsset es true", async () => {
    const admin = makeAdmin([
      { processing_status: "processing", is_active: false, original_video_storage_key: "k" },
    ]);
    h.createAdminClient.mockReturnValue(admin);

    const result = await getModuleHlsStatus("mod-1", "k");

    expect(result.hasPendingOrProcessingHlsAsset).toBe(true);
    expect(result.hasActiveHlsAsset).toBe(false);
  });

  it("dado data null, entonces devuelve todo en false (usa data ?? [])", async () => {
    const admin = makeAdmin(null);
    h.createAdminClient.mockReturnValue(admin);

    const result = await getModuleHlsStatus("mod-1", "k");

    expect(result).toEqual({
      hasActiveHlsAsset: false,
      hasPendingOrProcessingHlsAsset: false,
    });
  });
});

describe("hasActiveHlsAsset", () => {
  beforeEach(() => {
    h.createAdminClient.mockReset();
  });

  it("dado un asset ready y activo, entonces devuelve true", async () => {
    const admin = makeAdmin([
      { processing_status: "ready", is_active: true, original_video_storage_key: "k" },
    ]);
    h.createAdminClient.mockReturnValue(admin);

    expect(await hasActiveHlsAsset("mod-1", "k")).toBe(true);
  });

  it("dado un storage key nulo, entonces devuelve false", async () => {
    expect(await hasActiveHlsAsset("mod-1", null)).toBe(false);
  });
});
