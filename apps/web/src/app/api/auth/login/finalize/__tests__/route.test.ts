import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mocks hoisted: vi.mock se "iza" arriba del archivo. Centralizamos las funciones
// mockeadas acá para poder reprogramarlas por test.
const h = vi.hoisted(() => ({
  verifyLoginIntentToken: vi.fn(),
  decryptPendingLoginSession: vi.fn(),
  registerDevice: vi.fn(),
  setSession: vi.fn(),
  rpc: vi.fn(),
  intentMaybeSingle: vi.fn(),
  cookieStoreGet: vi.fn(),
  cookieStoreGetAll: vi.fn(),
  applyRouteCookies: vi.fn(),
  setSupabaseAuthCookies: vi.fn(),
}));

vi.mock("@/lib/auth/login-intents", () => ({
  verifyLoginIntentToken: h.verifyLoginIntentToken,
  decryptPendingLoginSession: h.decryptPendingLoginSession,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: h.intentMaybeSingle }),
      }),
    }),
    rpc: h.rpc,
  }),
}));

vi.mock("@/lib/supabase/route", () => ({
  createRouteClient: async () => ({
    supabase: { auth: { setSession: h.setSession } },
    cookiesToSet: [],
  }),
  applyRouteCookies: h.applyRouteCookies,
}));

vi.mock("@/lib/supabase/auth-cookies", () => ({
  setSupabaseAuthCookies: h.setSupabaseAuthCookies,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: h.cookieStoreGet,
    getAll: h.cookieStoreGetAll,
  }),
}));

vi.mock("@/lib/devices/register", () => ({
  registerDevice: h.registerDevice,
}));

import { POST } from "../route";

function makeRequest(
  body: unknown,
  init: { headers?: Record<string, string>; raw?: string } = {}
): Request {
  return new Request("http://localhost/api/auth/login/finalize", {
    method: "POST",
    headers: { "content-type": "application/json", ...init.headers },
    body: init.raw ?? JSON.stringify(body),
  });
}

const VALID_BODY = {
  login_intent_token: "intent-token",
  session_to_revoke_id: "session-vieja-id",
};

const VALID_CLAIMS = {
  jti: "intent-1",
  sub: "user-1",
  purpose: "device_picker" as const,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const VALID_INTENT_ROW = {
  id: "intent-1",
  user_id: "user-1",
  pending_session_ciphertext: "v1.cifrado",
  expires_at: new Date(Date.now() + 300_000).toISOString(),
  consumed_at: null,
};

const VALID_PENDING_SESSION = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  sessionId: "sess-1",
  cookiesToSet: [],
};

describe("POST /api/auth/login/finalize", () => {
  beforeEach(() => {
    // DEVICE_COOKIE_SECRET hace falta porque el happy path llama signDeviceId.
    vi.stubEnv("DEVICE_COOKIE_SECRET", "0123456789abcdef0123456789abcdef");
    h.cookieStoreGet.mockReturnValue(undefined);
    h.cookieStoreGetAll.mockReturnValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("validación de body", () => {
    it("devuelve 400 invalid_body cuando el body no es JSON", async () => {
      const res = await POST(makeRequest({}, { raw: "no-json{" }));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ error: "invalid_body" });
    });

    it("devuelve 400 missing_fields cuando falta el token", async () => {
      const res = await POST(makeRequest({ session_to_revoke_id: "x" }));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ error: "missing_fields" });
    });

    it("devuelve 400 missing_fields cuando falta la sesión a revocar", async () => {
      const res = await POST(makeRequest({ login_intent_token: "x" }));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ error: "missing_fields" });
    });
  });

  describe("intent inválido o expirado", () => {
    it("devuelve 401 intent_invalid cuando verifyLoginIntentToken tira un error genérico", async () => {
      // given
      h.verifyLoginIntentToken.mockImplementation(() => {
        throw new Error("intent_invalid");
      });

      // when
      const res = await POST(makeRequest(VALID_BODY));

      // then
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toMatchObject({ error: "intent_invalid" });
    });

    it("devuelve 401 intent_expired cuando el token expiró", async () => {
      // given
      h.verifyLoginIntentToken.mockImplementation(() => {
        throw new Error("intent_expired");
      });

      // when
      const res = await POST(makeRequest(VALID_BODY));

      // then
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toMatchObject({ error: "intent_expired" });
    });

    it("devuelve 401 intent_invalid cuando la fila del intent no existe", async () => {
      // given: token válido, pero la DB no encuentra el intent
      h.verifyLoginIntentToken.mockReturnValue(VALID_CLAIMS);
      h.intentMaybeSingle.mockResolvedValue({ data: null, error: null });

      // when
      const res = await POST(makeRequest(VALID_BODY));

      // then
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toMatchObject({ error: "intent_invalid" });
    });

    it("devuelve 401 intent_invalid cuando el user_id del intent no coincide con las claims", async () => {
      // given: intent en DB pertenece a otro user
      h.verifyLoginIntentToken.mockReturnValue(VALID_CLAIMS);
      h.intentMaybeSingle.mockResolvedValue({
        data: { ...VALID_INTENT_ROW, user_id: "otro-user" },
        error: null,
      });

      // when
      const res = await POST(makeRequest(VALID_BODY));

      // then
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toMatchObject({ error: "intent_invalid" });
    });

    it("devuelve 409 intent_consumed cuando el intent ya tiene consumed_at", async () => {
      // given
      h.verifyLoginIntentToken.mockReturnValue(VALID_CLAIMS);
      h.intentMaybeSingle.mockResolvedValue({
        data: {
          ...VALID_INTENT_ROW,
          consumed_at: "2026-05-28T12:00:00Z",
        },
        error: null,
      });

      // when
      const res = await POST(makeRequest(VALID_BODY));

      // then
      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toMatchObject({ error: "intent_consumed" });
    });

    it("devuelve 401 intent_expired cuando expires_at ya pasó", async () => {
      // given: expira en el pasado
      h.verifyLoginIntentToken.mockReturnValue(VALID_CLAIMS);
      h.intentMaybeSingle.mockResolvedValue({
        data: {
          ...VALID_INTENT_ROW,
          expires_at: new Date(Date.now() - 1000).toISOString(),
        },
        error: null,
      });

      // when
      const res = await POST(makeRequest(VALID_BODY));

      // then
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toMatchObject({ error: "intent_expired" });
    });

    it("devuelve 401 intent_invalid cuando el ciphertext no se puede desencriptar", async () => {
      // given
      h.verifyLoginIntentToken.mockReturnValue(VALID_CLAIMS);
      h.intentMaybeSingle.mockResolvedValue({ data: VALID_INTENT_ROW, error: null });
      h.decryptPendingLoginSession.mockImplementation(() => {
        throw new Error("intent_invalid");
      });

      // when
      const res = await POST(makeRequest(VALID_BODY));

      // then
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toMatchObject({ error: "intent_invalid" });
    });
  });

  describe("errores del RPC consume_login_intent_and_revoke_device", () => {
    beforeEach(() => {
      h.verifyLoginIntentToken.mockReturnValue(VALID_CLAIMS);
      h.intentMaybeSingle.mockResolvedValue({ data: VALID_INTENT_ROW, error: null });
      h.decryptPendingLoginSession.mockReturnValue(VALID_PENDING_SESSION);
    });

    it("devuelve 409 intent_consumed cuando el RPC señala login_intent_invalid_or_consumed", async () => {
      // given
      h.rpc.mockResolvedValue({
        error: { message: "login_intent_invalid_or_consumed" },
      });

      // when
      const res = await POST(makeRequest(VALID_BODY));

      // then
      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toMatchObject({ error: "intent_consumed" });
    });

    it("devuelve 404 device_not_found cuando el RPC señala device_not_found", async () => {
      // given
      h.rpc.mockResolvedValue({ error: { message: "device_not_found" } });

      // when
      const res = await POST(makeRequest(VALID_BODY));

      // then
      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toMatchObject({ error: "device_not_found" });
    });

    it("devuelve 500 server_error para otros errores del RPC", async () => {
      // given
      h.rpc.mockResolvedValue({ error: { message: "unexpected" } });

      // when
      const res = await POST(makeRequest(VALID_BODY));

      // then
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toMatchObject({ error: "server_error" });
    });
  });

  describe("camino feliz", () => {
    beforeEach(() => {
      h.verifyLoginIntentToken.mockReturnValue(VALID_CLAIMS);
      h.intentMaybeSingle.mockResolvedValue({ data: VALID_INTENT_ROW, error: null });
      h.decryptPendingLoginSession.mockReturnValue(VALID_PENDING_SESSION);
      h.rpc.mockResolvedValue({ error: null });
      h.registerDevice.mockResolvedValue({
        ok: true,
        deviceId: "device-nuevo",
        isNew: true,
      });
      h.setSession.mockResolvedValue({
        data: {
          session: {
            access_token: "new-access",
            refresh_token: "new-refresh",
          },
        },
        error: null,
      });
    });

    it("devuelve 200 con status ok cuando todo el flujo termina bien", async () => {
      // when
      const res = await POST(makeRequest(VALID_BODY));

      // then
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ status: "ok" });
    });

    it("setea la cookie del dispositivo firmada", async () => {
      // when
      const res = await POST(makeRequest(VALID_BODY));

      // then
      const setCookie = res.headers.get("set-cookie") ?? "";
      expect(setCookie).toMatch(/ah_device=device-nuevo\./);
    });

    it("devuelve 409 device_limit si registerDevice rechaza al dispositivo nuevo", async () => {
      // given: el RPC revocó la vieja, pero registerDevice todavía rechaza (raro pero posible)
      h.registerDevice.mockResolvedValue({
        ok: false,
        reason: "limit",
        limit: 2,
      });

      // when
      const res = await POST(makeRequest(VALID_BODY));

      // then
      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toMatchObject({ error: "device_limit" });
    });

    it("devuelve 500 server_error cuando setSession falla", async () => {
      // given
      h.setSession.mockResolvedValue({
        data: { session: null },
        error: { message: "auth failure" },
      });
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // when
      const res = await POST(makeRequest(VALID_BODY));

      // then
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toMatchObject({ error: "server_error" });
      errorSpy.mockRestore();
    });
  });
});
