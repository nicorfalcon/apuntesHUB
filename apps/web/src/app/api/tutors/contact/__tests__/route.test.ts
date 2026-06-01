import { describe, it, expect, beforeEach, vi } from "vitest";

// POST /api/tutors/contact: endpoint legacy de contacto. La mensajería ahora se
// habilita recién con la reserva confirmada, así que responde 410 (Gone) a un
// usuario logueado y 401 sin sesión.

const h = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

import { POST } from "../route";

beforeEach(() => {
  h.getUser.mockReset();
});

describe("POST tutors/contact", () => {
  it("con sesión devuelve 410 (mensajería deshabilitada acá)", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    expect((await POST()).status).toBe(410);
  });

  it("sin sesión devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST()).status).toBe(401);
  });
});
