import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mocks hoisted con vi.hoisted: vi.mock se "iza" arriba del archivo, así que
// los mocks que va a usar tienen que existir ya en ese momento. Este patrón es
// el canonical para compartir mock-fns entre vi.mock y los tests.
const h = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  registerDevice: vi.fn(),
  listActiveSessionsForUser: vi.fn(),
  cookieStoreGet: vi.fn(),
  cookieStoreGetAll: vi.fn(),
  applyRouteCookies: vi.fn(),
  setSupabaseAuthCookies: vi.fn(),
  adminInsert: vi.fn(),
}));

vi.mock("@/lib/supabase/route", () => ({
  createRouteClient: async () => ({
    supabase: {
      auth: { signInWithPassword: h.signInWithPassword },
    },
    cookiesToSet: [],
  }),
  applyRouteCookies: h.applyRouteCookies,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (_table: string) => ({ insert: h.adminInsert }),
  }),
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

vi.mock("@/lib/devices/active-sessions", () => ({
  listActiveSessionsForUser: h.listActiveSessionsForUser,
  // oldestSessionId es pura: la dejamos correr de verdad.
  oldestSessionId: (sessions: { id: string }[]) => sessions[0]?.id ?? null,
}));

import { POST } from "../route";

// Helper para fabricar el Request con el shape que espera el handler.
function makeRequest(
  body: unknown,
  init: { headers?: Record<string, string>; raw?: string } = {}
): Request {
  const headers = {
    "content-type": "application/json",
    "user-agent": "test-agent",
    ...init.headers,
  };
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers,
    body: init.raw ?? JSON.stringify(body),
  });
}

// Sesión Supabase mínima válida para los tests del happy path. El access_token
// es un JWT con payload base64 que contiene `session_id` (lo que el handler usa
// vía getSessionIdFromAccessToken).
function fakeSession() {
  const payload = Buffer.from(
    JSON.stringify({ session_id: "sess-1", sub: "user-1" })
  ).toString("base64");
  return {
    access_token: `header.${payload}.signature`,
    refresh_token: "refresh-token",
  };
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    // login-intents.ts y cookie.ts leen secrets de env: con stubs reales podemos
    // dejar que las funciones puras (encriptar intent, firmar device) corran de
    // verdad en vez de mockearlas. Ya están testeadas en sus propias suites.
    vi.stubEnv("DEVICE_COOKIE_SECRET", "0123456789abcdef0123456789abcdef");
    vi.stubEnv(
      "LOGIN_INTENT_SECRET",
      "login-intent-secret-de-mas-de-32-caracteres"
    );
    h.cookieStoreGet.mockReturnValue(undefined);
    h.cookieStoreGetAll.mockReturnValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("validación de body", () => {
    it("devuelve 400 invalid_body cuando el body no es JSON válido", async () => {
      // when
      const res = await POST(makeRequest({}, { raw: "no-soy-json{" }));

      // then
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        status: "error",
        error: "invalid_body",
        message: "Solicitud inválida.",
      });
    });

    it("devuelve 400 missing_credentials cuando falta el email", async () => {
      // when
      const res = await POST(makeRequest({ password: "x" }));

      // then
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({
        error: "missing_credentials",
      });
    });

    it("devuelve 400 missing_credentials cuando falta la contraseña", async () => {
      const res = await POST(makeRequest({ email: "user@test.com" }));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({
        error: "missing_credentials",
      });
    });
  });

  describe("credenciales inválidas", () => {
    it("devuelve 401 invalid_credentials cuando Supabase rechaza", async () => {
      // given: signInWithPassword devuelve error
      h.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials" },
      });

      // when
      const res = await POST(
        makeRequest({ email: "user@test.com", password: "mala" })
      );

      // then
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({
        status: "error",
        error: "invalid_credentials",
        message: "Email o contraseña incorrectos.",
      });
      // El device no se debería intentar registrar si el login falló.
      expect(h.registerDevice).not.toHaveBeenCalled();
    });

    it("devuelve 401 también cuando Supabase no devuelve user/session sin error", async () => {
      // given: caso defensivo del handler
      h.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      // when
      const res = await POST(
        makeRequest({ email: "user@test.com", password: "x" })
      );

      // then
      expect(res.status).toBe(401);
    });
  });

  describe("login exitoso", () => {
    beforeEach(() => {
      h.signInWithPassword.mockResolvedValue({
        data: { user: { id: "user-1" }, session: fakeSession() },
        error: null,
      });
    });

    it("devuelve 200 con status ok cuando registerDevice acepta el dispositivo", async () => {
      // given
      h.registerDevice.mockResolvedValue({
        ok: true,
        deviceId: "device-1",
        isNew: true,
      });

      // when
      const res = await POST(
        makeRequest({ email: "user@test.com", password: "valida" })
      );

      // then
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ status: "ok" });
    });

    it("setea la cookie del dispositivo firmada en la respuesta", async () => {
      // given
      h.registerDevice.mockResolvedValue({
        ok: true,
        deviceId: "device-1",
        isNew: true,
      });

      // when
      const res = await POST(
        makeRequest({ email: "user@test.com", password: "valida" })
      );

      // then: ah_device viene firmada (id.firma separados por punto)
      const setCookie = res.headers.get("set-cookie") ?? "";
      expect(setCookie).toMatch(/ah_device=device-1\.[A-Za-z0-9_-]+/);
    });

    it("pasa userAgent y brand desde los headers a registerDevice", async () => {
      // given
      h.registerDevice.mockResolvedValue({
        ok: true,
        deviceId: "d1",
        isNew: false,
      });

      // when
      await POST(
        makeRequest(
          { email: "user@test.com", password: "valida" },
          {
            headers: {
              "user-agent": "Mozilla/5.0 Firefox/120",
              "x-client-brand": "brave",
            },
          }
        )
      );

      // then: el handler le pasa los datos del request a la unidad de registro
      expect(h.registerDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          userAgent: "Mozilla/5.0 Firefox/120",
          brand: "brave",
          sessionId: "sess-1", // viene del payload del access_token
        })
      );
    });
  });

  describe("límite de dispositivos", () => {
    beforeEach(() => {
      h.signInWithPassword.mockResolvedValue({
        data: { user: { id: "user-1" }, session: fakeSession() },
        error: null,
      });
      h.registerDevice.mockResolvedValue({
        ok: false,
        reason: "limit",
        limit: 2,
      });
      h.listActiveSessionsForUser.mockResolvedValue([
        { id: "old-session", label: "Chrome", last_seen_at: "2026-05-20" },
        { id: "new-session", label: "Safari", last_seen_at: "2026-05-27" },
      ]);
      h.adminInsert.mockResolvedValue({ error: null });
    });

    it("devuelve session_limit_exceeded con las sesiones activas y la recomendada", async () => {
      // when
      const res = await POST(
        makeRequest({ email: "user@test.com", password: "valida" })
      );

      // then
      expect(res.status).toBe(200); // body lleva el status semántico
      const body = await res.json();
      expect(body.status).toBe("session_limit_exceeded");
      expect(body.active_sessions).toHaveLength(2);
      expect(body.recommended_session_id).toBe("old-session"); // la primera (más vieja)
      expect(typeof body.login_intent_token).toBe("string");
      expect(body.login_intent_token.split(".")).toHaveLength(3); // JWT
    });

    it("inserta el intent cifrado en la tabla login_intents", async () => {
      // when
      await POST(makeRequest({ email: "user@test.com", password: "valida" }));

      // then
      expect(h.adminInsert).toHaveBeenCalledTimes(1);
      const insertArg = h.adminInsert.mock.calls[0][0];
      expect(insertArg).toMatchObject({
        user_id: "user-1",
        // ciphertext con prefijo v1. (lo testea encrypted vía login-intents)
        pending_session_ciphertext: expect.stringMatching(/^v1\./),
      });
    });
  });

  describe("error inesperado", () => {
    it("devuelve 500 server_error cuando la inserción del intent falla", async () => {
      // given: registerDevice rechaza, listActive ok, pero el insert falla
      h.signInWithPassword.mockResolvedValue({
        data: { user: { id: "user-1" }, session: fakeSession() },
        error: null,
      });
      h.registerDevice.mockResolvedValue({ ok: false, reason: "limit", limit: 2 });
      h.listActiveSessionsForUser.mockResolvedValue([]);
      h.adminInsert.mockResolvedValue({
        error: { message: "permission denied" },
      });
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // when
      const res = await POST(
        makeRequest({ email: "user@test.com", password: "valida" })
      );

      // then
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toMatchObject({
        status: "error",
        error: "server_error",
      });
      errorSpy.mockRestore();
    });
  });
});
