import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mocks hoisted. lookup/pending son objetos mutables que cada test puede
// configurar para que el stub de admin devuelva lo que necesite.
const h = vi.hoisted(() => {
  const lookup: Record<string, { data: unknown; error: unknown }> = {};
  const pending: Record<string, { data: unknown; error: unknown }> = {};
  return {
    lookup,
    pending,
    resetLookup() {
      for (const k of Object.keys(lookup)) delete lookup[k];
    },
    resetPending() {
      for (const k of Object.keys(pending)) delete pending[k];
    },
    validateSignature: vi.fn(),
    rpc: vi.fn(),
    fetch: vi.fn(),
    getValidAccessToken: vi.fn(),
    sendResume: vi.fn(),
    sendCourse: vi.fn(),
    sendTutoring: vi.fn(),
  };
});

vi.mock("@/lib/mercadopago/webhook-signature", () => ({
  validateSignature: h.validateSignature,
}));

vi.mock("@/lib/mercadopago/refresh-token", () => ({
  getValidAccessToken: h.getValidAccessToken,
}));

vi.mock("@/lib/email/sale-notifications", () => ({
  sendResumeSaleNotification: h.sendResume,
  sendCourseSaleNotification: h.sendCourse,
  sendTutoringBookingNotifications: h.sendTutoring,
}));

// Stub del admin client: las cadenas .from().select().eq()...maybeSingle() y
// ...limit() devuelven lo que esté configurado en h.lookup / h.pending para esa
// tabla. La rpc usa el mock dedicado.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: async () => h.pending[table] ?? { data: [], error: null },
        maybeSingle: async () => h.lookup[table] ?? { data: null, error: null },
      };
      return chain;
    },
    rpc: h.rpc,
  }),
}));

import { POST } from "../route";

function makeRequest(
  body: unknown,
  init: {
    headers?: Record<string, string>;
    dataId?: string;
    raw?: string;
  } = {}
): NextRequest {
  const url = init.dataId
    ? `http://localhost/api/webhooks/mercadopago?data.id=${init.dataId}`
    : "http://localhost/api/webhooks/mercadopago";
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": "ts=1,v1=abc",
      "x-request-id": "req-1",
      ...init.headers,
    },
    body: init.raw ?? JSON.stringify(body),
  });
}

const PAYMENT_BODY = {
  type: "payment",
  action: "payment.created",
  data: { id: "1234567890" },
};

describe("POST /api/webhooks/mercadopago", () => {
  beforeEach(() => {
    h.resetLookup();
    h.resetPending();
    vi.stubGlobal("fetch", h.fetch);
    // Para evitar ruido en los tests de errores controlados.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe("autenticación y validación", () => {
    it("devuelve 401 cuando faltan los headers de firma", async () => {
      // when: pedido sin x-signature
      const req = new NextRequest("http://localhost/api/webhooks/mercadopago", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(PAYMENT_BODY),
      });
      const res = await POST(req);

      // then
      expect(res.status).toBe(401);
      expect(h.validateSignature).not.toHaveBeenCalled();
    });

    it("devuelve 401 cuando la firma no valida", async () => {
      // given
      h.validateSignature.mockReturnValue(false);

      // when
      const res = await POST(makeRequest(PAYMENT_BODY, { dataId: "1234567890" }));

      // then
      expect(res.status).toBe(401);
    });

    it("devuelve 400 cuando el body no es JSON", async () => {
      // given
      h.validateSignature.mockReturnValue(true);

      // when
      const res = await POST(makeRequest({}, { raw: "no-es-json{", dataId: "1" }));

      // then
      expect(res.status).toBe(400);
    });

    it("ignora eventos que no son de tipo payment", async () => {
      // given
      h.validateSignature.mockReturnValue(true);

      // when
      const res = await POST(
        makeRequest({ type: "merchant_order", data: { id: "1" } }, { dataId: "1" })
      );

      // then
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ received: true });
      // No debería tocar la DB ni la API de MP para este evento.
      expect(h.fetch).not.toHaveBeenCalled();
    });
  });

  describe("procesamiento de pagos", () => {
    beforeEach(() => {
      h.validateSignature.mockReturnValue(true);
    });

    it("sale temprano (idempotencia) si la compra ya está completed", async () => {
      // given: la idempotencia encuentra una purchase ya completada
      h.lookup.purchases = {
        data: { id: "p1", status: "completed" },
        error: null,
      };

      // when
      const res = await POST(
        makeRequest(PAYMENT_BODY, { dataId: "1234567890" })
      );

      // then
      expect(res.status).toBe(200);
      // No debería buscar pendings, ni pegarle a MP, ni llamar RPC.
      expect(h.fetch).not.toHaveBeenCalled();
      expect(h.rpc).not.toHaveBeenCalled();
    });

    it("no hace nada si no hay sellers/tutores con pagos pendientes", async () => {
      // given: pending vacío en las 3 tablas (default)
      // when
      const res = await POST(
        makeRequest(PAYMENT_BODY, { dataId: "1234567890" })
      );

      // then
      expect(res.status).toBe(200);
      expect(h.fetch).not.toHaveBeenCalled();
      expect(h.rpc).not.toHaveBeenCalled();
    });

    it("aprueba la compra de un apunte e invoca complete_purchase + notificación", async () => {
      // given: hay un seller con compra pendiente; MP devuelve approved con
      // external_reference de purchase (sin prefijo).
      h.pending.purchases = { data: [{ seller_id: "seller-1" }], error: null };
      h.getValidAccessToken.mockResolvedValue("mp-token");
      h.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "approved",
          external_reference: "purchase-uuid-1",
          transaction_amount: 1000,
        }),
      });
      h.rpc.mockResolvedValue({ data: true, error: null });
      h.sendResume.mockResolvedValue(undefined);

      // when
      const res = await POST(
        makeRequest(PAYMENT_BODY, { dataId: "1234567890" })
      );

      // then
      expect(res.status).toBe(200);
      expect(h.rpc).toHaveBeenCalledWith("complete_purchase", {
        p_purchase_id: "purchase-uuid-1",
        p_payment_id: "1234567890",
      });
      expect(h.sendResume).toHaveBeenCalledWith(
        expect.anything(),
        "purchase-uuid-1",
        "1234567890"
      );
    });

    it("rechaza la compra de un apunte e invoca fail_purchase sin notificar", async () => {
      // given
      h.pending.purchases = { data: [{ seller_id: "seller-1" }], error: null };
      h.getValidAccessToken.mockResolvedValue("mp-token");
      h.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "rejected",
          external_reference: "purchase-uuid-1",
          transaction_amount: 0,
        }),
      });
      h.rpc.mockResolvedValue({ data: false, error: null });

      // when
      const res = await POST(
        makeRequest(PAYMENT_BODY, { dataId: "1234567890" })
      );

      // then
      expect(res.status).toBe(200);
      expect(h.rpc).toHaveBeenCalledWith("fail_purchase", expect.anything());
      // No notificar en rechazo.
      expect(h.sendResume).not.toHaveBeenCalled();
    });

    it("aprueba una inscripción a curso e invoca complete_course_enrollment", async () => {
      // given: pending en course_enrollments; el shape del join trae author_id
      h.pending.course_enrollments = {
        data: [{ recorded_courses: { author_id: "author-1" } }],
        error: null,
      };
      h.getValidAccessToken.mockResolvedValue("mp-token");
      h.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "approved",
          external_reference: "course_enrollment:enroll-uuid",
          transaction_amount: 5000,
        }),
      });
      h.rpc.mockResolvedValue({ data: true, error: null });
      h.sendCourse.mockResolvedValue(undefined);

      // when
      const res = await POST(
        makeRequest(PAYMENT_BODY, { dataId: "1234567890" })
      );

      // then
      expect(res.status).toBe(200);
      expect(h.rpc).toHaveBeenCalledWith("complete_course_enrollment", {
        p_enrollment_id: "enroll-uuid",
        p_payment_id: "1234567890",
      });
      expect(h.sendCourse).toHaveBeenCalled();
    });

    it("aprueba una reserva de tutoría e invoca complete_tutoring_booking + notificaciones", async () => {
      // given: pending en tutor_bookings; MP devuelve approved con prefijo de tutoring.
      h.pending.tutor_bookings = { data: [{ tutor_id: "tutor-1" }], error: null };
      h.getValidAccessToken.mockResolvedValue("mp-token");
      h.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "approved",
          external_reference: "tutoring_booking:booking-uuid",
          transaction_amount: 8000,
        }),
      });
      // didConfirm === true habilita el dispatch de emails.
      h.rpc.mockResolvedValue({ data: true, error: null });
      h.sendTutoring.mockResolvedValue(undefined);

      // when
      const res = await POST(
        makeRequest(PAYMENT_BODY, { dataId: "1234567890" })
      );

      // then
      expect(res.status).toBe(200);
      expect(h.rpc).toHaveBeenCalledWith("complete_tutoring_booking", {
        p_booking_id: "booking-uuid",
        p_payment_id: "1234567890",
      });
      expect(h.sendTutoring).toHaveBeenCalled();
    });

    it("para tutoring rejected invoca fail_tutoring_booking sin notificar", async () => {
      // given
      h.pending.tutor_bookings = { data: [{ tutor_id: "tutor-1" }], error: null };
      h.getValidAccessToken.mockResolvedValue("mp-token");
      h.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "rejected",
          external_reference: "tutoring_booking:booking-uuid",
          transaction_amount: 0,
        }),
      });
      h.rpc.mockResolvedValue({ data: null, error: null });

      // when
      const res = await POST(
        makeRequest(PAYMENT_BODY, { dataId: "1234567890" })
      );

      // then
      expect(res.status).toBe(200);
      expect(h.rpc).toHaveBeenCalledWith("fail_tutoring_booking", expect.anything());
      expect(h.sendTutoring).not.toHaveBeenCalled();
    });

    it("no llama ningún RPC cuando el pago sigue pending o in_process", async () => {
      // given
      h.pending.purchases = { data: [{ seller_id: "seller-1" }], error: null };
      h.getValidAccessToken.mockResolvedValue("mp-token");
      h.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "pending",
          external_reference: "purchase-uuid",
          transaction_amount: 1000,
        }),
      });

      // when
      const res = await POST(
        makeRequest(PAYMENT_BODY, { dataId: "1234567890" })
      );

      // then
      expect(res.status).toBe(200);
      expect(h.rpc).not.toHaveBeenCalled();
    });

    it("devuelve 200 (silencio) si no se pudo obtener el pago de la API de MP", async () => {
      // given: ningún token sirve para consultar el pago
      h.pending.purchases = { data: [{ seller_id: "seller-1" }], error: null };
      h.getValidAccessToken.mockResolvedValue("mp-token");
      h.fetch.mockResolvedValue({ ok: false, json: async () => ({}) });

      // when
      const res = await POST(
        makeRequest(PAYMENT_BODY, { dataId: "1234567890" })
      );

      // then: 200 igual (MP no reintenta indefinidamente errores nuestros)
      expect(res.status).toBe(200);
      expect(h.rpc).not.toHaveBeenCalled();
    });
  });
});
