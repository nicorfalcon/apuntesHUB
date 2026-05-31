import { describe, it, expect, beforeEach, vi } from "vitest";

// registerDevice orquesta dos dependencias externas: el admin client de Supabase
// (createAdminClient) y los helpers de firma/parseo de ./cookie. Mockeamos ambos
// para testear sólo la lógica de decisión: reusar dispositivo, aplicar el límite
// o dar de alta uno nuevo.
const h = vi.hoisted(() => ({ createAdminClient: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: h.createAdminClient,
}));

vi.mock("../cookie", () => ({
  DEVICE_INACTIVE_DAYS: 30,
  DEVICE_LIMIT: 3,
  hashIp: (ip: string) => `hash(${ip})`,
  newDeviceId: () => "new-device-id",
  parseUserAgentLabel: () => "Etiqueta Parseada",
  // Sólo "valid-signed" resuelve a un deviceId existente; el resto es null.
  verifyDeviceId: (cookie: string | null | undefined) =>
    cookie === "valid-signed" ? "existing-device-id" : null,
}));

import { registerDevice } from "../register";

type AdminOpts = {
  existingDevice?: { id: string; user_id: string } | null;
  activeCount?: number;
  insertError?: { message: string } | null;
};

function makeAdmin(opts: AdminOpts) {
  const calls: { updated: unknown; inserted: unknown } = {
    updated: null,
    inserted: null,
  };
  const admin = {
    from: vi.fn(() => ({
      select: vi.fn((_cols: string, options?: { count?: string }) => {
        if (options?.count) {
          // Query de conteo de dispositivos activos: .eq().gte() -> { count }
          return {
            eq: () => ({
              gte: async () => ({ count: opts.activeCount ?? 0 }),
            }),
          };
        }
        // Lookup del dispositivo existente: .eq().eq().maybeSingle() -> { data }
        return {
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: opts.existingDevice ?? null }),
            }),
          }),
        };
      }),
      update: vi.fn((payload: unknown) => {
        calls.updated = payload;
        return { eq: async () => ({ error: null }) };
      }),
      insert: vi.fn(async (payload: unknown) => {
        calls.inserted = payload;
        return { error: opts.insertError ?? null };
      }),
    })),
  };
  return { admin, calls };
}

const baseInput = {
  userId: "user-1",
  signedCookie: undefined as string | undefined | null,
  userAgent: "Mozilla/5.0",
  ip: "1.2.3.4",
};

describe("registerDevice", () => {
  beforeEach(() => {
    h.createAdminClient.mockReset();
  });

  it("dado un cookie válido cuyo dispositivo existe, entonces lo reusa y refresca last_seen (isNew=false)", async () => {
    const { admin, calls } = makeAdmin({
      existingDevice: { id: "row-1", user_id: "user-1" },
    });
    h.createAdminClient.mockReturnValue(admin);

    const result = await registerDevice({
      ...baseInput,
      signedCookie: "valid-signed",
      sessionId: "sess-9",
    });

    expect(result).toEqual({
      ok: true,
      deviceId: "existing-device-id",
      isNew: false,
    });
    // Refresca metadata del dispositivo, incluyendo la sesión rotada.
    expect(calls.updated).toMatchObject({
      label: "Etiqueta Parseada",
      user_agent: "Mozilla/5.0",
      ip_hash: "hash(1.2.3.4)",
      session_id: "sess-9",
    });
    expect(calls.inserted).toBeNull();
  });

  it("dado un dispositivo nuevo bajo el límite, entonces lo da de alta (isNew=true)", async () => {
    const { admin, calls } = makeAdmin({
      existingDevice: null,
      activeCount: 1,
    });
    h.createAdminClient.mockReturnValue(admin);

    const result = await registerDevice(baseInput);

    expect(result).toEqual({
      ok: true,
      deviceId: "new-device-id",
      isNew: true,
    });
    expect(calls.inserted).toMatchObject({
      user_id: "user-1",
      device_id: "new-device-id",
      ip_hash: "hash(1.2.3.4)",
    });
  });

  it("dado que el usuario alcanzó el límite de dispositivos activos, entonces rechaza sin insertar", async () => {
    const { admin, calls } = makeAdmin({
      existingDevice: null,
      activeCount: 3, // == DEVICE_LIMIT
    });
    h.createAdminClient.mockReturnValue(admin);

    const result = await registerDevice(baseInput);

    expect(result).toEqual({ ok: false, reason: "device_limit", limit: 3 });
    expect(calls.inserted).toBeNull();
  });

  it("dado un deviceLabel explícito, entonces lo usa en vez de parsear el user-agent", async () => {
    const { admin, calls } = makeAdmin({ existingDevice: null, activeCount: 0 });
    h.createAdminClient.mockReturnValue(admin);

    await registerDevice({ ...baseInput, deviceLabel: "iPhone de Jero" });

    expect(calls.inserted).toMatchObject({ label: "iPhone de Jero" });
  });

  it("dado un IP nulo, entonces guarda ip_hash null", async () => {
    const { admin, calls } = makeAdmin({ existingDevice: null, activeCount: 0 });
    h.createAdminClient.mockReturnValue(admin);

    await registerDevice({ ...baseInput, ip: null });

    expect(calls.inserted).toMatchObject({ ip_hash: null });
  });

  it("dado un error de inserción, entonces lanza", async () => {
    const { admin } = makeAdmin({
      existingDevice: null,
      activeCount: 0,
      insertError: { message: "duplicate key" },
    });
    h.createAdminClient.mockReturnValue(admin);

    await expect(registerDevice(baseInput)).rejects.toThrow(
      "Failed to register device: duplicate key"
    );
  });
});
