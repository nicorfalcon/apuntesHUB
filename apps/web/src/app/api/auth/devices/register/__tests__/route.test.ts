import { describe, it, expect, beforeEach, vi } from "vitest";

// Mockeamos en el límite: Supabase, cookies y registerDevice (la lógica de
// negocio del límite ya tiene sus propios tests). El handler solo orquesta.

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
  cookieGet: vi.fn(),
  registerDevice: vi.fn(),
  signDeviceId: vi.fn(),
  ipFromHeaders: vi.fn(),
  getSessionIdFromAccessToken: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser, getSession: h.getSession },
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: h.cookieGet }),
}));

vi.mock("@/lib/devices/cookie", () => ({
  DEVICE_COOKIE_NAME: "ah-device",
  DEVICE_COOKIE_MAX_AGE_SECONDS: 60 * 60 * 24 * 365,
  signDeviceId: h.signDeviceId,
  ipFromHeaders: h.ipFromHeaders,
  getSessionIdFromAccessToken: h.getSessionIdFromAccessToken,
}));

vi.mock("@/lib/devices/client-hints", () => ({
  CLIENT_BRAND_HEADER: "x-client-brand",
}));

vi.mock("@/lib/devices/register", () => ({
  registerDevice: h.registerDevice,
}));

import { POST } from "../route";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/auth/devices/register", {
    method: "POST",
    headers: { "user-agent": "ua", ...headers },
  });
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  h.signDeviceId.mockReturnValue("signed-cookie");
  h.ipFromHeaders.mockReturnValue("1.2.3.4");
  h.getSessionIdFromAccessToken.mockReturnValue("sess-1");
  h.getSession.mockResolvedValue({
    data: { session: { access_token: "tok" } },
  });
});

describe("POST /api/auth/devices/register", () => {
  it("dado un visitante no autenticado, entonces devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthenticated");
  });

  it("dado un usuario válido, entonces llama registerDevice con userAgent, IP y brand y devuelve ok+isNew", async () => {
    // GIVEN
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.cookieGet.mockReturnValue({ value: "old-signed" });
    h.registerDevice.mockResolvedValue({
      ok: true,
      isNew: true,
      deviceId: "dev-new",
    });

    // WHEN
    const res = await POST(makeRequest({ "x-client-brand": "brave" }));
    const body = await res.json();

    // THEN
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, isNew: true });
    expect(h.registerDevice).toHaveBeenCalledWith({
      userId: "u-1",
      signedCookie: "old-signed",
      userAgent: "ua",
      ip: "1.2.3.4",
      brand: "brave",
      sessionId: "sess-1",
    });
    // Cookie firmada del device se setea en la respuesta.
    expect(res.headers.get("set-cookie") ?? "").toContain("ah-device=signed-cookie");
  });

  it("dado un header de brand ausente o desconocido, entonces brand pasa como null a registerDevice", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.cookieGet.mockReturnValue(undefined);
    h.registerDevice.mockResolvedValue({
      ok: true,
      isNew: false,
      deviceId: "dev-1",
    });
    await POST(makeRequest({ "x-client-brand": "chrome" }));
    expect(h.registerDevice).toHaveBeenCalledWith(
      expect.objectContaining({ brand: null })
    );
  });

  it("dado que registerDevice rechaza por límite, entonces devuelve 403 con reason y limit", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.cookieGet.mockReturnValue(undefined);
    h.registerDevice.mockResolvedValue({
      ok: false,
      reason: "device_limit_reached",
      limit: 2,
    });

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body).toEqual({ error: "device_limit_reached", limit: 2 });
  });
});
