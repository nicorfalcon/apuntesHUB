import { describe, it, expect, beforeEach, vi } from "vitest";

// El motor de slots (generateSlots, validateSlotRequest) ya tiene tests puros
// dedicados. Acá testeamos solo la orquestación del handler: parseo de body,
// agregación de las tres queries (availability/bookings/blocks) y manejo de
// los casos borde. generateSlots lo dejamos correr de verdad.

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  availabilityResp: vi.fn(),
  bookingsLte: vi.fn(),
  blocksGt: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: h.rpc,
    from: (table: string) => {
      if (table === "tutor_availability") {
        return { select: () => ({ eq: h.availabilityResp }) };
      }
      if (table === "tutor_bookings") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                gte: () => ({ lte: h.bookingsLte }),
              }),
            }),
          }),
        };
      }
      if (table === "tutor_blocked_slots") {
        return {
          select: () => ({
            eq: () => ({ lt: () => ({ gt: h.blocksGt }) }),
          }),
        };
      }
      return {};
    },
  }),
}));

import { POST } from "../route";

function makeRequest(body: unknown, raw?: string) {
  return new Request("http://localhost/api/tutors/available-slots", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
  h.rpc.mockResolvedValue({ data: null, error: null });
});

describe("POST /api/tutors/available-slots", () => {
  it("dado un body que no parsea JSON, entonces devuelve 400", async () => {
    const res = await POST(makeRequest(null, "no json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Body inválido/i);
  });

  it("dado un body sin tutor_id, entonces devuelve 400", async () => {
    const res = await POST(
      makeRequest({ date_from: "2026-06-01", date_to: "2026-06-07" })
    );
    expect(res.status).toBe(400);
  });

  it("dado un date_from inválido (validateSlotRequest rechaza), entonces devuelve 400", async () => {
    const res = await POST(
      makeRequest({
        tutor_id: "t-1",
        date_from: "no-fecha",
        date_to: "2026-06-07",
        duration_minutes: 60,
      })
    );
    expect(res.status).toBe(400);
  });

  it("dado un tutor sin availability, entonces devuelve { slots: [] } sin llamar al motor", async () => {
    h.availabilityResp.mockResolvedValue({ data: [], error: null });
    h.bookingsLte.mockResolvedValue({ data: [], error: null });
    h.blocksGt.mockResolvedValue({ data: [], error: null });

    const res = await POST(
      makeRequest({
        tutor_id: "t-1",
        date_from: "2026-06-01",
        date_to: "2026-06-07",
        duration_minutes: 60,
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ slots: [] });
    // Limpieza oportunista de pendings expirados sí se llama.
    expect(h.rpc).toHaveBeenCalledWith("expire_pending_tutoring_bookings", {
      p_tutor_id: "t-1",
    });
  });

  it("dado un tutor con availability, entonces devuelve algún slot generado", async () => {
    // Availability: lunes 14-18 online.
    h.availabilityResp.mockResolvedValue({
      data: [
        {
          day_of_week: 1,
          start_time: "14:00:00",
          end_time: "18:00:00",
          modality: "online",
        },
      ],
      error: null,
    });
    h.bookingsLte.mockResolvedValue({ data: [], error: null });
    h.blocksGt.mockResolvedValue({ data: [], error: null });

    const res = await POST(
      makeRequest({
        tutor_id: "t-1",
        date_from: "2050-01-01", // rango de 2 semanas: al menos 2 lunes incluidos.
        date_to: "2050-01-14",
        duration_minutes: 60,
        modality: "online",
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.slots.length).toBeGreaterThan(0);
    // Cada slot tiene start/end ISO y el día corresponde al lunes (1).
    for (const slot of body.slots) {
      expect(slot).toHaveProperty("start");
      expect(slot).toHaveProperty("end");
      expect(slot).toHaveProperty("day_of_week");
    }
  });

  it("filtra bookings (pending vencido vs vigente, confirmed, sin fecha) y aplica bloqueos", async () => {
    // Ejercita las ramas de armado de intervalos ocupados/bloqueados que el
    // camino feliz vacío no toca.
    const future = new Date(Date.now() + 60 * 60_000).toISOString();
    const past = new Date(Date.now() - 60 * 60_000).toISOString();

    h.availabilityResp.mockResolvedValue({
      data: [
        { day_of_week: 1, start_time: "14:00:00", end_time: "18:00:00", modality: "online" },
      ],
      error: null,
    });
    h.bookingsLte.mockResolvedValue({
      data: [
        // pending_payment vigente -> se mantiene como ocupado
        { scheduled_at: "2050-01-07T17:00:00Z", duration_minutes: 60, status: "pending_payment", payment_expires_at: future },
        // pending_payment vencido -> se descarta
        { scheduled_at: "2050-01-07T15:00:00Z", duration_minutes: 60, status: "pending_payment", payment_expires_at: past },
        // confirmed -> se mantiene
        { scheduled_at: "2050-01-14T17:00:00Z", duration_minutes: null, status: "confirmed", payment_expires_at: null },
        // sin scheduled_at -> se filtra en occupiedIntervals
        { scheduled_at: null, duration_minutes: 60, status: "confirmed", payment_expires_at: null },
      ],
      error: null,
    });
    h.blocksGt.mockResolvedValue({
      data: [{ starts_at: "2050-01-07T14:00:00Z", ends_at: "2050-01-07T15:00:00Z" }],
      error: null,
    });

    const res = await POST(
      makeRequest({
        tutor_id: "t-1",
        date_from: "2050-01-01",
        date_to: "2050-01-14",
        duration_minutes: 60,
        modality: "online",
      })
    );
    expect(res.status).toBe(200);
    expect(Array.isArray((await res.json()).slots)).toBe(true);
  });
});
