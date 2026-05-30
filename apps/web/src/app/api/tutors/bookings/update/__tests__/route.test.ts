import { describe, it, expect, beforeEach, vi } from "vitest";

// Cubrimos las 3 acciones del handler: cancel, complete y details. Para
// details mockeamos dynamic imports de templates + resend y dispatching por
// tabla (tutor_bookings vs profiles).

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  bookingSingle: vi.fn(),
  currentBookingSingle: vi.fn(),
  updateEq: vi.fn(),
  profileSingle: vi.fn(),
  getUserById: vi.fn(),
  sendTransactionalEmail: vi.fn(),
  // Counter compartido entre llamadas .single() de tutor_bookings: la 1ra es
  // el booking inicial, la 2da+ (cuando hay action=details) es currentBooking.
  bookingSingleCount: { n: 0 },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => ({ single: h.profileSingle }) }),
        };
      }
      // tutor_bookings: la primera .single() es el initial booking; las
      // siguientes (cuando hay action=details) son currentBooking.
      return {
        select: () => ({
          eq: () => ({
            single: () => {
              const n = h.bookingSingleCount.n++;
              return n === 0 ? h.bookingSingle() : h.currentBookingSingle();
            },
          }),
        }),
        update: () => ({ eq: h.updateEq }),
      };
    },
    auth: { admin: { getUserById: h.getUserById } },
  }),
}));

vi.mock("@/lib/email/templates", () => ({
  buildStudentBookingDetailsEmail: () => ({
    subject: "Datos de tu clase",
    html: "<p>html</p>",
    text: "text",
  }),
}));

vi.mock("@/lib/email/resend", () => ({
  sendTransactionalEmail: h.sendTransactionalEmail,
}));

import { POST } from "../route";

function makeRequest(body: unknown, raw?: string) {
  return new Request("http://localhost/api/tutors/bookings/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  for (const value of Object.values(h)) {
    if (typeof value === "function" && "mockReset" in value) {
      (value as { mockReset: () => void }).mockReset();
    }
  }
  h.bookingSingleCount.n = 0;
});

describe("POST /api/tutors/bookings/update", () => {
  it("dado un visitante no autenticado, entonces devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest({ booking_id: "b-1", action: "cancel" }));
    expect(res.status).toBe(401);
  });

  it("dado un body que no parsea JSON, entonces devuelve 400", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    const res = await POST(makeRequest(null, "no json"));
    expect(res.status).toBe(400);
  });

  it("dado un body sin booking_id o action, entonces devuelve 400", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    const res = await POST(makeRequest({ booking_id: "b-1" }));
    expect(res.status).toBe(400);
  });

  it("dado un action no soportado, entonces devuelve 400", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    const res = await POST(makeRequest({ booking_id: "b-1", action: "weird" }));
    expect(res.status).toBe(400);
  });

  it("dado un booking_id que no existe, entonces devuelve 404", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.bookingSingle.mockResolvedValue({
      data: null,
      error: { message: "x" },
    });
    const res = await POST(makeRequest({ booking_id: "b-x", action: "cancel" }));
    expect(res.status).toBe(404);
  });

  it("dado un usuario que no es parte del booking, entonces devuelve 403", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-other" } } });
    h.bookingSingle.mockResolvedValue({
      data: {
        id: "b-1",
        tutor_id: "t-1",
        student_id: "s-1",
        status: "confirmed",
        scheduled_at: "2099-01-01T00:00:00Z",
        amount: 1000,
      },
      error: null,
    });
    const res = await POST(makeRequest({ booking_id: "b-1", action: "cancel" }));
    expect(res.status).toBe(403);
  });

  describe("action: cancel", () => {
    it("dado un booking en estado no cancelable, entonces devuelve 400", async () => {
      h.getUser.mockResolvedValue({ data: { user: { id: "t-1" } } });
      h.bookingSingle.mockResolvedValue({
        data: {
          id: "b-1",
          tutor_id: "t-1",
          student_id: "s-1",
          status: "completed",
          scheduled_at: "2099-01-01T00:00:00Z",
          amount: 1000,
        },
        error: null,
      });
      const res = await POST(makeRequest({ booking_id: "b-1", action: "cancel" }));
      expect(res.status).toBe(400);
    });

    it("dado el alumno cancelando con menos de 24h, entonces devuelve 400", async () => {
      h.getUser.mockResolvedValue({ data: { user: { id: "s-1" } } });
      // 1 hora en el futuro
      const oneHourAhead = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      h.bookingSingle.mockResolvedValue({
        data: {
          id: "b-1",
          tutor_id: "t-1",
          student_id: "s-1",
          status: "confirmed",
          scheduled_at: oneHourAhead,
          amount: 1000,
        },
        error: null,
      });
      const res = await POST(makeRequest({ booking_id: "b-1", action: "cancel" }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/24 horas/);
    });

    it("dado el alumno cancelando con más de 24h, entonces marca cancelled y refund_required=false", async () => {
      h.getUser.mockResolvedValue({ data: { user: { id: "s-1" } } });
      const farFuture = new Date(
        Date.now() + 5 * 24 * 60 * 60 * 1000
      ).toISOString();
      h.bookingSingle.mockResolvedValue({
        data: {
          id: "b-1",
          tutor_id: "t-1",
          student_id: "s-1",
          status: "confirmed",
          scheduled_at: farFuture,
          amount: 1000,
        },
        error: null,
      });
      h.updateEq.mockResolvedValue({ error: null });

      const res = await POST(makeRequest({ booking_id: "b-1", action: "cancel" }));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        cancelled_by: "student",
        refund_required: false,
      });
    });

    it("dado el tutor cancelando un confirmed, entonces marca cancelled y refund_required=true", async () => {
      h.getUser.mockResolvedValue({ data: { user: { id: "t-1" } } });
      h.bookingSingle.mockResolvedValue({
        data: {
          id: "b-1",
          tutor_id: "t-1",
          student_id: "s-1",
          status: "confirmed",
          scheduled_at: "2099-01-01T00:00:00Z",
          amount: 1000,
        },
        error: null,
      });
      h.updateEq.mockResolvedValue({ error: null });

      const res = await POST(makeRequest({ booking_id: "b-1", action: "cancel" }));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toMatchObject({
        cancelled_by: "tutor",
        refund_required: true,
      });
    });
  });

  describe("action: complete", () => {
    it("dado un alumno intentando completar, entonces devuelve 403", async () => {
      h.getUser.mockResolvedValue({ data: { user: { id: "s-1" } } });
      h.bookingSingle.mockResolvedValue({
        data: {
          id: "b-1",
          tutor_id: "t-1",
          student_id: "s-1",
          status: "confirmed",
          scheduled_at: "x",
          amount: 1000,
        },
        error: null,
      });
      const res = await POST(makeRequest({ booking_id: "b-1", action: "complete" }));
      expect(res.status).toBe(403);
    });

    it("dado un booking no confirmed, entonces devuelve 400", async () => {
      h.getUser.mockResolvedValue({ data: { user: { id: "t-1" } } });
      h.bookingSingle.mockResolvedValue({
        data: {
          id: "b-1",
          tutor_id: "t-1",
          student_id: "s-1",
          status: "pending_payment",
          scheduled_at: "x",
          amount: 1000,
        },
        error: null,
      });
      const res = await POST(makeRequest({ booking_id: "b-1", action: "complete" }));
      expect(res.status).toBe(400);
    });

    it("dado el tutor completando un confirmed, entonces devuelve success", async () => {
      h.getUser.mockResolvedValue({ data: { user: { id: "t-1" } } });
      h.bookingSingle.mockResolvedValue({
        data: {
          id: "b-1",
          tutor_id: "t-1",
          student_id: "s-1",
          status: "confirmed",
          scheduled_at: "x",
          amount: 1000,
        },
        error: null,
      });
      h.updateEq.mockResolvedValue({ error: null });

      const res = await POST(makeRequest({ booking_id: "b-1", action: "complete" }));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });

  describe("action: details", () => {
    const tutorBooking = {
      id: "b-1",
      tutor_id: "t-1",
      student_id: "s-1",
      status: "confirmed",
      scheduled_at: "2099-06-01T17:00:00Z",
      amount: 3500,
    };

    beforeEach(() => {
      h.getUser.mockResolvedValue({ data: { user: { id: "t-1" } } });
      h.bookingSingle.mockResolvedValue({ data: tutorBooking, error: null });
    });

    it("dado un alumno intentando editar detalles, entonces devuelve 403", async () => {
      h.getUser.mockResolvedValue({ data: { user: { id: "s-1" } } });
      const res = await POST(
        makeRequest({
          booking_id: "b-1",
          action: "details",
          meeting_url: "https://meet/x",
        })
      );
      expect(res.status).toBe(403);
    });

    it("dado un booking no confirmed, entonces devuelve 400", async () => {
      h.bookingSingle.mockResolvedValue({
        data: { ...tutorBooking, status: "requested" },
        error: null,
      });
      const res = await POST(
        makeRequest({
          booking_id: "b-1",
          action: "details",
          meeting_url: "https://meet/x",
        })
      );
      expect(res.status).toBe(400);
    });

    it("dado una meeting_url no https, entonces devuelve 400", async () => {
      const res = await POST(
        makeRequest({
          booking_id: "b-1",
          action: "details",
          meeting_url: "http://insecure/x",
        })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/https/i);
    });

    it("dado un fetch de currentBooking fallido, entonces devuelve 500", async () => {
      h.currentBookingSingle.mockResolvedValue({
        data: null,
        error: { message: "x" },
      });
      const res = await POST(
        makeRequest({
          booking_id: "b-1",
          action: "details",
          meeting_url: "https://meet/x",
        })
      );
      expect(res.status).toBe(500);
    });

    it("dado que no hay cambios, entonces devuelve emailed=false sin updatear ni mandar email", async () => {
      h.currentBookingSingle.mockResolvedValue({
        data: {
          meeting_url: "https://meet/x",
          location_details: null,
          scheduled_at: tutorBooking.scheduled_at,
          duration_minutes: 60,
          subjects: { name: "Análisis" },
        },
        error: null,
      });

      const res = await POST(
        makeRequest({
          booking_id: "b-1",
          action: "details",
          meeting_url: "https://meet/x",
        })
      );
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toMatchObject({ success: true, emailed: false });
      expect(h.sendTransactionalEmail).not.toHaveBeenCalled();
    });

    it("dado un update con cambios + email del student disponible, entonces persiste y manda email", async () => {
      h.currentBookingSingle.mockResolvedValue({
        data: {
          meeting_url: null,
          location_details: null,
          scheduled_at: tutorBooking.scheduled_at,
          duration_minutes: 60,
          subjects: { name: "Análisis" },
        },
        error: null,
      });
      h.updateEq.mockResolvedValue({ error: null });
      h.profileSingle
        .mockResolvedValueOnce({ data: { display_name: "Juan" } })
        .mockResolvedValueOnce({ data: { display_name: "María" } });
      h.getUserById.mockResolvedValue({
        data: { user: { email: "student@test.com" } },
        error: null,
      });

      const res = await POST(
        makeRequest({
          booking_id: "b-1",
          action: "details",
          meeting_url: "https://meet.google.com/x",
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toMatchObject({ success: true, emailed: true });
      expect(h.sendTransactionalEmail).toHaveBeenCalledOnce();
      const email = h.sendTransactionalEmail.mock.calls[0][0];
      expect(email.to).toBe("student@test.com");
      // idempotencyKey incluye el booking_id y un hash del contenido
      expect(email.idempotencyKey).toContain(
        "tutor-booking-details-student-b-1"
      );
    });

    it("dado un update con cambios pero sin email del student, entonces persiste con emailed=false", async () => {
      h.currentBookingSingle.mockResolvedValue({
        data: {
          meeting_url: null,
          location_details: null,
          scheduled_at: tutorBooking.scheduled_at,
          duration_minutes: 60,
          subjects: { name: "Análisis" },
        },
        error: null,
      });
      h.updateEq.mockResolvedValue({ error: null });
      h.profileSingle.mockResolvedValue({ data: { display_name: "x" } });
      h.getUserById.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const res = await POST(
        makeRequest({
          booking_id: "b-1",
          action: "details",
          meeting_url: "https://meet.google.com/x",
        })
      );
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.emailed).toBe(false);
      expect(h.sendTransactionalEmail).not.toHaveBeenCalled();
    });

    it("dado que el update DB falla, entonces devuelve 500 con el mensaje", async () => {
      h.currentBookingSingle.mockResolvedValue({
        data: {
          meeting_url: null,
          location_details: null,
          scheduled_at: tutorBooking.scheduled_at,
          duration_minutes: 60,
          subjects: { name: "Análisis" },
        },
        error: null,
      });
      h.updateEq.mockResolvedValue({ error: { message: "db down" } });

      const res = await POST(
        makeRequest({
          booking_id: "b-1",
          action: "details",
          meeting_url: "https://meet/x",
        })
      );
      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe("db down");
    });
  });
});
