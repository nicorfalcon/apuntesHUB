import { describe, it, expect, beforeEach, vi } from "vitest";

// POST /api/tutors/messages: mensajería entre alumno y tutor de una reserva.
// Solo participantes de un booking confirmado/completado/cancelado pueden
// escribir. Mockeamos auth y el admin client (booking lookup + insert + touch).

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  booking: { value: null as Record<string, unknown> | null },
  message: { value: { id: "msg-1" } as { id: string } | null },
  messageError: { value: null as { message: string } | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "tutor_bookings") {
        const c: Record<string, unknown> = {};
        c.select = () => c;
        c.eq = () => c;
        c.update = () => c;
        c.single = async () => ({ data: h.booking.value });
        c.then = (r: (v: unknown) => void) => r({ error: null }); // update().eq()
        return c;
      }
      // tutor_messages
      const c: Record<string, unknown> = {};
      c.insert = () => c;
      c.select = () => c;
      c.single = async () => ({ data: h.message.value, error: h.messageError.value });
      return c;
    },
  }),
}));

import { POST } from "../route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/tutors/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.getUser.mockReset();
  h.getUser.mockResolvedValue({ data: { user: { id: "student-1" } } });
  h.booking.value = {
    id: BOOKING_ID,
    tutor_id: "tutor-1",
    student_id: "student-1",
    status: "confirmed",
  };
  h.message.value = { id: "msg-1" };
  h.messageError.value = null;
});

describe("POST tutors/messages", () => {
  it("un participante de un booking confirmado envía el mensaje (200)", async () => {
    const res = await POST(makeReq({ booking_id: BOOKING_ID, body: "Hola profe" }));
    expect(res.status).toBe(200);
    expect((await res.json()).message_id).toBe("msg-1");
  });

  it("sin sesión devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(makeReq({ booking_id: BOOKING_ID, body: "x" }))).status).toBe(401);
  });

  it("sin booking_id o body devuelve 400", async () => {
    expect((await POST(makeReq({ body: "hola" }))).status).toBe(400);
    expect((await POST(makeReq({ booking_id: BOOKING_ID }))).status).toBe(400);
  });

  it("con un body demasiado largo devuelve 400", async () => {
    const long = "a".repeat(1001);
    expect((await POST(makeReq({ booking_id: BOOKING_ID, body: long }))).status).toBe(400);
  });

  it("si el usuario no es participante del booking devuelve 403", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "intruso" } } });
    expect((await POST(makeReq({ booking_id: BOOKING_ID, body: "hola" }))).status).toBe(403);
  });

  it("si el booking no está confirmado aún devuelve 403", async () => {
    h.booking.value = { ...h.booking.value, status: "pending" };
    expect((await POST(makeReq({ booking_id: BOOKING_ID, body: "hola" }))).status).toBe(403);
  });

  it("si falla el insert del mensaje devuelve 500", async () => {
    h.message.value = null;
    h.messageError.value = { message: "db" };
    expect((await POST(makeReq({ booking_id: BOOKING_ID, body: "hola" }))).status).toBe(500);
  });
});
