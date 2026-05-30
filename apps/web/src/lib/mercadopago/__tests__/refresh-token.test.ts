import { describe, it, expect, beforeEach, vi } from "vitest";

// Stubeamos fetch global + admin client. La función pura de decisión "¿hay
// que refrescar?" depende del threshold (7 días) y vive dentro del handler,
// así que testeamos los dos caminos (token vigente vs token vencido).

const h = vi.hoisted(() => ({
  credsSingle: vi.fn(),
  updateEq: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: h.credsSingle }) }),
      update: () => ({ eq: h.updateEq }),
    }),
  }),
}));

import { getValidAccessToken } from "../refresh-token";

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  vi.stubEnv("MP_APP_ID", "app-1");
  vi.stubEnv("MP_CLIENT_SECRET", "secret");
  vi.stubGlobal("fetch", h.fetch);
});

describe("getValidAccessToken", () => {
  it("dado que no hay credenciales, entonces lanza error", async () => {
    h.credsSingle.mockResolvedValue({
      data: null,
      error: { message: "missing" },
    });
    await expect(getValidAccessToken("s-1")).rejects.toThrow(
      /no encontradas/i
    );
  });

  it("dado que el token está vigente por más de 7 días, entonces devuelve el actual sin pegarle a MP", async () => {
    const farFuture = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    h.credsSingle.mockResolvedValue({
      data: {
        mp_access_token: "still-valid",
        mp_refresh_token: "ref",
        mp_token_expires_at: farFuture,
      },
      error: null,
    });

    const token = await getValidAccessToken("s-1");
    expect(token).toBe("still-valid");
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it("dado que el token está por expirar (<=7 días), entonces pide refresh a MP y persiste el nuevo", async () => {
    const soon = new Date(
      Date.now() + 2 * 24 * 60 * 60 * 1000
    ).toISOString();
    h.credsSingle.mockResolvedValue({
      data: {
        mp_access_token: "old",
        mp_refresh_token: "ref-old",
        mp_token_expires_at: soon,
      },
      error: null,
    });
    h.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-token",
        refresh_token: "ref-new",
        public_key: "pk-new",
        user_id: 1,
        expires_in: 60 * 60 * 24 * 60,
        token_type: "bearer",
      }),
    });
    h.updateEq.mockResolvedValue({ error: null });

    const token = await getValidAccessToken("s-1");
    expect(token).toBe("new-token");
    expect(h.fetch).toHaveBeenCalledWith(
      "https://api.mercadopago.com/oauth/token",
      expect.objectContaining({ method: "POST" })
    );
    expect(h.updateEq).toHaveBeenCalledWith("id", "s-1");
  });

  it("dado que el refresh falla (HTTP no ok), entonces lanza error con status", async () => {
    const soon = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
    h.credsSingle.mockResolvedValue({
      data: {
        mp_access_token: "old",
        mp_refresh_token: "ref-old",
        mp_token_expires_at: soon,
      },
      error: null,
    });
    h.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "invalid_grant",
    });

    await expect(getValidAccessToken("s-1")).rejects.toThrow(/401/);
  });

  it("dado que MP devuelve ok pero el update en DB falla, entonces lanza error", async () => {
    const soon = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
    h.credsSingle.mockResolvedValue({
      data: {
        mp_access_token: "old",
        mp_refresh_token: "ref-old",
        mp_token_expires_at: soon,
      },
      error: null,
    });
    h.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "x",
        refresh_token: "y",
        public_key: "z",
        user_id: 1,
        expires_in: 1000,
        token_type: "bearer",
      }),
    });
    h.updateEq.mockResolvedValue({ error: { message: "db down" } });

    await expect(getValidAccessToken("s-1")).rejects.toThrow(/db down/);
  });
});
