import { describe, it, expect, beforeEach, vi } from "vitest";

// GET /api/messages/unread-count: cuenta los mensajes no leídos del usuario en
// sus bookings de tutoría. Sin sesión o sin bookings devuelve 0.

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  bookings: { value: [] as Array<{ id: string }> },
  unread: { value: 0 },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    from: (table: string) => {
      if (table === "tutor_bookings") {
        const c: Record<string, unknown> = {};
        c.select = () => c;
        c.or = () => c;
        c.in = () => c;
        c.then = (r: (v: unknown) => void) => r({ data: h.bookings.value });
        return c;
      }
      // tutor_messages
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.in = () => c;
      c.neq = () => c;
      c.is = () => c;
      c.then = (r: (v: unknown) => void) => r({ count: h.unread.value });
      return c;
    },
  }),
}));

import { GET } from "../route";

beforeEach(() => {
  h.getUser.mockReset();
  h.bookings.value = [];
  h.unread.value = 0;
  h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("GET messages/unread-count", () => {
  it("sin sesión devuelve count 0", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect((await (await GET()).json()).count).toBe(0);
  });

  it("sin bookings devuelve count 0 sin contar mensajes", async () => {
    h.bookings.value = [];
    h.unread.value = 99; // no debería usarse
    expect((await (await GET()).json()).count).toBe(0);
  });

  it("con bookings, devuelve la cantidad de no leídos", async () => {
    h.bookings.value = [{ id: "b1" }, { id: "b2" }];
    h.unread.value = 3;
    expect((await (await GET()).json()).count).toBe(3);
  });
});
