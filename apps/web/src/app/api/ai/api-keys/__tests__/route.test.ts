import { describe, it, expect, beforeEach, vi } from "vitest";

// GET/POST /api/ai/api-keys: gestión de las API keys BYOK del usuario.
// validateApiKey y encryptApiKey ya tienen tests de unidad; acá validamos la
// orquestación del handler (validaciones, límite de 5, verificación previa).

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  validate: vi.fn(),
  encrypt: vi.fn(),
  keys: { value: [] as unknown[] },
  keysError: { value: null as { message: string } | null },
  count: { value: 0 },
  insertResult: { value: { id: "key-1" } as unknown },
  insertError: { value: null as { message: string } | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/ai/validate-key", () => ({ validateApiKey: h.validate }));
vi.mock("@/lib/crypto/api-key-encryption", () => ({
  encryptApiKey: h.encrypt,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = () => c;
      c.insert = () => c;
      c.order = async () => ({ data: h.keys.value, error: h.keysError.value });
      c.single = async () => ({
        data: h.insertResult.value,
        error: h.insertError.value,
      });
      c.then = (r: (v: unknown) => void) => r({ count: h.count.value });
      return c;
    },
  }),
}));

import { GET, POST } from "../route";

function postReq(body: unknown, raw?: string) {
  return new Request("http://localhost/api/ai/api-keys", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

const VALID = {
  provider: "openai",
  displayName: "Mi clave",
  modelId: "gpt-4o",
  apiKey: "sk-abcdefghijklmnop",
};

beforeEach(() => {
  Object.values(h).forEach((v) => (typeof v === "function" ? v.mockReset?.() : null));
  h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  h.validate.mockResolvedValue(true);
  h.encrypt.mockReturnValue({ encrypted: "enc", iv: "iv" });
  h.keys.value = [{ id: "k1", provider: "openai" }];
  h.keysError.value = null;
  h.count.value = 1;
  h.insertResult.value = { id: "key-1" };
  h.insertError.value = null;
});

describe("GET ai/api-keys", () => {
  it("lista las keys activas del usuario", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).keys).toHaveLength(1);
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET()).status).toBe(401);
  });
});

describe("POST ai/api-keys", () => {
  it("dado un body válido y key verificada, crea la key (201)", async () => {
    const res = await POST(postReq(VALID));
    expect(res.status).toBe(201);
    expect(h.validate).toHaveBeenCalledWith("openai", VALID.apiKey);
    expect(h.encrypt).toHaveBeenCalled();
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(postReq(VALID))).status).toBe(401);
  });

  it("con body no-JSON devuelve 400", async () => {
    expect((await POST(postReq(null, "no-json"))).status).toBe(400);
  });

  it("con campos faltantes devuelve 400", async () => {
    expect((await POST(postReq({ provider: "openai" }))).status).toBe(400);
  });

  it("con proveedor no soportado devuelve 400", async () => {
    expect((await POST(postReq({ ...VALID, provider: "anthropic" }))).status).toBe(400);
  });

  it("con apiKey demasiado corta devuelve 400", async () => {
    expect((await POST(postReq({ ...VALID, apiKey: "corta" }))).status).toBe(400);
  });

  it("si ya tiene 5 keys devuelve 429", async () => {
    h.count.value = 5;
    expect((await POST(postReq(VALID))).status).toBe(429);
  });

  it("si la key no pasa la verificación devuelve 422", async () => {
    h.validate.mockResolvedValue(false);
    expect((await POST(postReq(VALID))).status).toBe(422);
  });

  it("si falla el insert devuelve 500", async () => {
    h.insertResult.value = null;
    h.insertError.value = { message: "db" };
    expect((await POST(postReq(VALID))).status).toBe(500);
  });
});
