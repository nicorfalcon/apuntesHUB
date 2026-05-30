import { describe, it, expect, beforeEach, vi } from "vitest";

// Tests del path principal de sendResumeSaleNotification: trae la purchase,
// resuelve email + nombres y delega el envío en sendTransactionalEmail. Lo
// mockeamos como spy para verificar el contenido sin pegarle a Resend.

const h = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("../resend", () => ({
  sendTransactionalEmail: h.sendTransactionalEmail,
}));

import {
  sendResumeSaleNotification,
  sendCourseSaleNotification,
  sendTutoringBookingNotifications,
} from "../sale-notifications";

type AdminMock = Parameters<typeof sendResumeSaleNotification>[0];

function fakeAdmin(opts: {
  purchase?: unknown;
  sellerEmail?: string | null;
  sellerProfile?: { display_name: string | null } | null;
  buyerProfile?: { display_name: string | null } | null;
}): AdminMock {
  return {
    from: (table: string) => {
      if (table === "purchases") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: opts.purchase }),
                }),
              }),
            }),
          }),
        };
      }
      // profiles
      const isBuyer =
        opts.buyerProfile && opts.sellerProfile
          ? Math.random() > 0.5 // any
          : false;
      void isBuyer;
      return {
        select: () => ({
          eq: (_col: string, id: string) => ({
            maybeSingle: async () => ({
              data:
                id === "seller-1"
                  ? opts.sellerProfile
                  : opts.buyerProfile,
            }),
          }),
        }),
      };
    },
    auth: {
      admin: {
        getUserById: async (_id: string) => ({
          data: { user: opts.sellerEmail ? { email: opts.sellerEmail } : null },
          error: null,
        }),
      },
    },
  } as unknown as AdminMock;
}

beforeEach(() => {
  h.sendTransactionalEmail.mockReset();
});

describe("sendResumeSaleNotification", () => {
  it("dado que no encuentra la purchase, entonces no envía email", async () => {
    await sendResumeSaleNotification(
      fakeAdmin({ purchase: null }),
      "p-1",
      "pay-1"
    );
    expect(h.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("dado que el seller no tiene email, entonces no envía email", async () => {
    await sendResumeSaleNotification(
      fakeAdmin({
        purchase: {
          id: "p-1",
          seller_id: "seller-1",
          buyer_id: "buyer-1",
          amount: 1000,
          platform_fee: 100,
          seller_amount: 900,
          resumes: { title: "X", subject: "S", university: "U" },
        },
        sellerEmail: null,
      }),
      "p-1",
      "pay-1"
    );
    expect(h.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("dado el camino feliz, entonces envía email al seller con idempotencyKey y subject", async () => {
    await sendResumeSaleNotification(
      fakeAdmin({
        purchase: {
          id: "p-1",
          seller_id: "seller-1",
          buyer_id: "buyer-1",
          amount: 1000,
          platform_fee: 100,
          seller_amount: 900,
          resumes: { title: "Análisis I", subject: "Mate", university: "ITBA" },
        },
        sellerEmail: "seller@test.com",
        sellerProfile: { display_name: "Juan" },
        buyerProfile: { display_name: "María" },
      }),
      "p-1",
      "pay-1"
    );

    expect(h.sendTransactionalEmail).toHaveBeenCalledOnce();
    const call = h.sendTransactionalEmail.mock.calls[0][0];
    expect(call.to).toBe("seller@test.com");
    // idempotency key es estable: <purchaseId>-<paymentId>
    expect(call.idempotencyKey).toBe("seller-sale-resume-p-1-pay-1");
    expect(call.subject).toBeTruthy();
    expect(call.html).toContain("Análisis I");
  });
});

// ── Course ───────────────────────────────────────────────────────────────────

function fakeAdminCourse(opts: {
  enrollment?: unknown;
  authorEmail?: string | null;
  profiles?: Record<string, { display_name: string | null }>;
}): AdminMock {
  return {
    from: (table: string) => {
      if (table === "course_enrollments") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: opts.enrollment }),
                }),
              }),
            }),
          }),
        };
      }
      // profiles
      return {
        select: () => ({
          eq: (_col: string, id: string) => ({
            maybeSingle: async () => ({
              data: opts.profiles?.[id] ?? null,
            }),
          }),
        }),
      };
    },
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: opts.authorEmail ? { email: opts.authorEmail } : null },
          error: null,
        }),
      },
    },
  } as unknown as AdminMock;
}

describe("sendCourseSaleNotification", () => {
  it("dado que no encuentra el enrollment, entonces no envía email", async () => {
    await sendCourseSaleNotification(
      fakeAdminCourse({ enrollment: null }),
      "e-1",
      "pay-1"
    );
    expect(h.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("dado un enrollment sin author email, entonces no envía email", async () => {
    await sendCourseSaleNotification(
      fakeAdminCourse({
        enrollment: {
          id: "e-1",
          student_id: "student-1",
          amount: 2500,
          platform_fee: 250,
          seller_amount: 2250,
          recorded_courses: {
            title: "Curso E2E",
            author_id: "author-1",
            subjects: { name: "Mate", university: "ITBA" },
          },
        },
        authorEmail: null,
      }),
      "e-1",
      "pay-1"
    );
    expect(h.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("dado el camino feliz, entonces envía email al author con idempotencyKey course y title del curso en html", async () => {
    await sendCourseSaleNotification(
      fakeAdminCourse({
        enrollment: {
          id: "e-1",
          student_id: "student-1",
          amount: 2500,
          platform_fee: 250,
          seller_amount: 2250,
          recorded_courses: {
            title: "Cálculo Avanzado",
            author_id: "author-1",
            subjects: { name: "Mate", university: "ITBA" },
          },
        },
        authorEmail: "author@test.com",
        profiles: {
          "author-1": { display_name: "Juan" },
          "student-1": { display_name: "María" },
        },
      }),
      "e-1",
      "pay-1"
    );

    expect(h.sendTransactionalEmail).toHaveBeenCalledOnce();
    const call = h.sendTransactionalEmail.mock.calls[0][0];
    expect(call.to).toBe("author@test.com");
    expect(call.idempotencyKey).toBe("seller-sale-course-e-1-pay-1");
    expect(call.html).toContain("Cálculo Avanzado");
    // Usa "Alumno" como label (kind=course) en lugar de "Comprador".
    expect(call.html).toMatch(/Alumno/);
  });
});

// ── Tutoring booking ─────────────────────────────────────────────────────────

function fakeAdminTutoring(opts: {
  booking?: unknown;
  bookingError?: unknown;
  emails?: Record<string, string | null>;
  profiles?: Record<string, { display_name: string | null }>;
}): AdminMock {
  return {
    from: (table: string) => {
      if (table === "tutor_bookings") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: opts.booking,
                    error: opts.bookingError ?? null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      // profiles
      return {
        select: () => ({
          eq: (_col: string, id: string) => ({
            maybeSingle: async () => ({
              data: opts.profiles?.[id] ?? null,
            }),
          }),
        }),
      };
    },
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: {
            user: opts.emails?.[id] ? { email: opts.emails[id] } : null,
          },
          error: null,
        }),
      },
    },
  } as unknown as AdminMock;
}

describe("sendTutoringBookingNotifications", () => {
  const baseBooking = {
    id: "b-1",
    student_id: "student-1",
    tutor_id: "tutor-1",
    scheduled_at: "2099-06-01T17:00:00Z",
    duration_minutes: 60,
    modality: "online",
    amount: 3500,
    status: "confirmed",
    meeting_url: null,
    location_details: null,
    subjects: { name: "Análisis" },
  };

  it("dado que no encuentra el booking, entonces no envía emails", async () => {
    await sendTutoringBookingNotifications(
      fakeAdminTutoring({ booking: null }),
      "b-1",
      "pay-1"
    );
    expect(h.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("dado un error de DB, entonces no envía emails (no propaga)", async () => {
    await sendTutoringBookingNotifications(
      fakeAdminTutoring({ bookingError: { message: "db down" } }),
      "b-1",
      "pay-1"
    );
    expect(h.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("dado un booking sin scheduled_at, entonces no envía emails", async () => {
    await sendTutoringBookingNotifications(
      fakeAdminTutoring({
        booking: { ...baseBooking, scheduled_at: null },
      }),
      "b-1",
      "pay-1"
    );
    expect(h.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("dado que ni tutor ni student tienen email, entonces no envía emails", async () => {
    await sendTutoringBookingNotifications(
      fakeAdminTutoring({
        booking: baseBooking,
        emails: { "tutor-1": null, "student-1": null },
      }),
      "b-1",
      "pay-1"
    );
    expect(h.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("dado el camino feliz, entonces envía emails al tutor y al student con idempotency keys distintas", async () => {
    await sendTutoringBookingNotifications(
      fakeAdminTutoring({
        booking: baseBooking,
        emails: {
          "tutor-1": "tutor@test.com",
          "student-1": "student@test.com",
        },
        profiles: {
          "tutor-1": { display_name: "Juan" },
          "student-1": { display_name: "María" },
        },
      }),
      "b-1",
      "pay-1"
    );

    expect(h.sendTransactionalEmail).toHaveBeenCalledTimes(2);
    const calls = h.sendTransactionalEmail.mock.calls.map((c) => c[0]);
    const toEmails = calls.map((c) => c.to);
    expect(toEmails).toContain("tutor@test.com");
    expect(toEmails).toContain("student@test.com");
    // Idempotency keys distintas para tutor vs student.
    const keys = calls.map((c) => c.idempotencyKey);
    expect(new Set(keys).size).toBe(2);
    expect(keys.some((k) => k.includes("tutor"))).toBe(true);
    expect(keys.some((k) => k.includes("student"))).toBe(true);
  });

  it("dado solo email del tutor, entonces envía 1 email (al tutor)", async () => {
    await sendTutoringBookingNotifications(
      fakeAdminTutoring({
        booking: baseBooking,
        emails: {
          "tutor-1": "tutor@test.com",
          "student-1": null,
        },
        profiles: {
          "tutor-1": { display_name: "Juan" },
          "student-1": { display_name: "María" },
        },
      }),
      "b-1",
      "pay-1"
    );

    expect(h.sendTransactionalEmail).toHaveBeenCalledOnce();
    expect(h.sendTransactionalEmail.mock.calls[0][0].to).toBe(
      "tutor@test.com"
    );
  });
});
