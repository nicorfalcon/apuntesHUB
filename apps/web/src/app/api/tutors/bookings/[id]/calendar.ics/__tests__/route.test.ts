import { describe, it, expect, beforeEach, vi } from "vitest";

// GET /api/tutors/bookings/[id]/calendar.ics: descarga del .ics de una clase
// confirmada. generateIcsContent ya está testeado; acá validamos autorización,
// precondiciones (agendada + confirmada) y el armado de la respuesta.

const ID = "11111111-1111-4111-8111-111111111111";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  booking: { value: null as Record<string, unknown> | null },
  bookingError: { value: null as { message: string } | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = () => c;
      c.single = async () => ({ data: h.booking.value, error: h.bookingError.value });
      return c;
    },
  }),
}));

import { GET } from "../route";

function makeReq(id = ID) {
  return {
    req: new Request(`http://localhost/api/tutors/bookings/${id}/calendar.ics`) as unknown as Parameters<typeof GET>[0],
    params: Promise.resolve({ id }),
  };
}

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    tutor_id: "tutor-1",
    student_id: "student-1",
    status: "confirmed",
    scheduled_at: "2026-06-01T17:00:00Z",
    duration_minutes: 60,
    modality: "online",
    meeting_url: "https://meet.test/abc",
    location_details: null,
    initial_message: "Quiero repasar integrales.",
    subjects: { name: "Cálculo" },
    student: { display_name: "Estu Lucas" },
    tutor: { display_name: "Profe Ana" },
    ...overrides,
  };
}

beforeEach(() => {
  h.getUser.mockReset();
  h.booking.value = booking();
  h.bookingError.value = null;
  h.getUser.mockResolvedValue({ data: { user: { id: "student-1" } } });
});

describe("GET calendar.ics", () => {
  it("devuelve el .ics de una clase confirmada", async () => {
    const { req, params } = makeReq();
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/calendar");
    expect(res.headers.get("Content-Disposition")).toContain(`clase_${ID}.ics`);
    const text = await res.text();
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("Cálculo");
  });

  it("sin usuario devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const { req, params } = makeReq();
    expect((await GET(req, { params })).status).toBe(401);
  });

  it("si no encuentra el booking devuelve 404", async () => {
    h.booking.value = null;
    h.bookingError.value = { message: "no rows" };
    const { req, params } = makeReq();
    expect((await GET(req, { params })).status).toBe(404);
  });

  it("si el usuario no es participante devuelve 403", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "intruso" } } });
    const { req, params } = makeReq();
    expect((await GET(req, { params })).status).toBe(403);
  });

  it("si la reserva no tiene horario devuelve 400", async () => {
    h.booking.value = booking({ scheduled_at: null });
    const { req, params } = makeReq();
    expect((await GET(req, { params })).status).toBe(400);
  });

  it("si la reserva no está confirmada devuelve 400", async () => {
    h.booking.value = booking({ status: "pending" });
    const { req, params } = makeReq();
    expect((await GET(req, { params })).status).toBe(400);
  });

  it("modalidad presencial usa location_details", async () => {
    h.booking.value = booking({
      modality: "presencial",
      meeting_url: null,
      location_details: "Aula 3, Pabellón I",
    });
    const { req, params } = makeReq();
    const text = await (await GET(req, { params })).text();
    expect(text).toContain("Aula 3");
  });

  it("modalidad 'ambas' con link y ubicación combina ambos", async () => {
    h.booking.value = booking({
      modality: "ambas",
      meeting_url: "https://meet.test/xyz",
      location_details: "Aula 3",
    });
    const text = await (await GET(makeReq().req, { params: makeReq().params })).text();
    expect(text).toContain("Aula 3");
    expect(text).toContain("meet.test/xyz");
  });

  it("resuelve nombres y materia cuando vienen como array (join de Supabase)", async () => {
    h.booking.value = booking({
      tutor: [{ display_name: "Profe Array" }],
      student: [{ display_name: "Estu Array" }],
      subjects: [{ name: "Física" }],
      initial_message: null, // cubre la rama sin nota
    });
    const text = await (await GET(makeReq().req, { params: makeReq().params })).text();
    expect(text).toContain("Profe Array");
    expect(text).toContain("Física");
  });
});
