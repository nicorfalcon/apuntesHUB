import { describe, it, expect, beforeEach, vi } from "vitest";

// Patrón canonical: vi.hoisted + vi.mock en el límite. Mockeamos cookies(),
// supabase server client (auth.getUser + from().select().eq().order()) y la
// función pura de verificación del device cookie. La lógica de mapeo a
// `is_current` queda corriendo de verdad.

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  order: vi.fn(),
  cookieGet: vi.fn(),
  verifyDeviceId: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: h.order,
        }),
      }),
    }),
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: h.cookieGet }),
}));

vi.mock("@/lib/devices/cookie", () => ({
  DEVICE_COOKIE_NAME: "ah-device",
  verifyDeviceId: h.verifyDeviceId,
}));

import { GET } from "../route";

beforeEach(() => {
  h.getUser.mockReset();
  h.order.mockReset();
  h.cookieGet.mockReset();
  h.verifyDeviceId.mockReset();
});

describe("GET /api/auth/devices/list", () => {
  it("dado un visitante no autenticado, cuando lista, entonces devuelve 401", async () => {
    // GIVEN
    h.getUser.mockResolvedValue({ data: { user: null } });

    // WHEN
    const res = await GET();
    const body = await res.json();

    // THEN
    expect(res.status).toBe(401);
    expect(body.error).toBe("unauthenticated");
  });

  it("dado que Supabase falla al traer dispositivos, entonces devuelve 500 con el mensaje", async () => {
    // GIVEN
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.cookieGet.mockReturnValue(undefined);
    h.verifyDeviceId.mockReturnValue(null);
    h.order.mockResolvedValue({ data: null, error: { message: "db down" } });

    // WHEN
    const res = await GET();
    const body = await res.json();

    // THEN
    expect(res.status).toBe(500);
    expect(body.error).toBe("db down");
  });

  it("dado un usuario con dos devices y cookie del segundo, entonces marca is_current=true solo en ese", async () => {
    // GIVEN: la cookie verificada matchea el device_id del segundo registro.
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.cookieGet.mockReturnValue({ value: "raw-cookie" });
    h.verifyDeviceId.mockReturnValue("dev-uuid-2");
    h.order.mockResolvedValue({
      data: [
        {
          id: "row-1",
          device_id: "dev-uuid-1",
          label: "Mac de casa",
          user_agent: "ua-1",
          created_at: "2026-05-01",
          last_seen_at: "2026-05-29",
        },
        {
          id: "row-2",
          device_id: "dev-uuid-2",
          label: "iPhone",
          user_agent: "ua-2",
          created_at: "2026-05-02",
          last_seen_at: "2026-05-28",
        },
      ],
      error: null,
    });

    // WHEN
    const res = await GET();
    const body = await res.json();

    // THEN
    expect(res.status).toBe(200);
    expect(body.devices).toHaveLength(2);
    expect(body.devices[0]).toMatchObject({ id: "row-1", is_current: false });
    expect(body.devices[1]).toMatchObject({ id: "row-2", is_current: true });
    // device_id no se filtra al cliente (es secreto).
    expect(body.devices[0]).not.toHaveProperty("device_id");
  });

  it("dado un usuario sin cookie de dispositivo válida, entonces todos los devices quedan is_current=false", async () => {
    // GIVEN
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.cookieGet.mockReturnValue(undefined);
    h.verifyDeviceId.mockReturnValue(null);
    h.order.mockResolvedValue({
      data: [
        {
          id: "row-1",
          device_id: "dev-uuid-1",
          label: "L",
          user_agent: "ua",
          created_at: "2026-05-01",
          last_seen_at: "2026-05-29",
        },
      ],
      error: null,
    });

    // WHEN
    const res = await GET();
    const body = await res.json();

    // THEN
    expect(body.devices[0].is_current).toBe(false);
  });

  it("dado un usuario sin devices registrados, entonces devuelve lista vacía", async () => {
    // GIVEN
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.cookieGet.mockReturnValue(undefined);
    h.verifyDeviceId.mockReturnValue(null);
    h.order.mockResolvedValue({ data: [], error: null });

    // WHEN
    const res = await GET();
    const body = await res.json();

    // THEN
    expect(res.status).toBe(200);
    expect(body.devices).toEqual([]);
  });
});
