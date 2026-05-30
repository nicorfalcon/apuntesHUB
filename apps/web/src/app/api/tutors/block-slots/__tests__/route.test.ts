import { describe, it, expect, beforeEach, vi } from "vitest";

// Tests del CRUD de bloqueos. Mockeamos auth + admin (is_tutor check) y la
// inserción/borrado/listado en `tutor_blocked_slots`. Las funciones puras de
// timezone se dejan correr para validar el formato de fechas.

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  isTutorSingle: vi.fn(),
  blocksOrder: vi.fn(),
  insertSingle: vi.fn(),
  deleteMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    from: () => ({
      insert: () => ({
        select: () => ({ single: h.insertSingle }),
      }),
      delete: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({ maybeSingle: h.deleteMaybeSingle }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => ({ single: h.isTutorSingle }) }),
        };
      }
      // tutor_blocked_slots
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({ order: h.blocksOrder }),
          }),
        }),
      };
    },
  }),
}));

import { GET, POST, DELETE } from "../route";

function makePost(body: unknown, raw?: string) {
  return new Request("http://localhost/api/tutors/block-slots", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

function makeDelete(body: unknown, raw?: string) {
  return new Request("http://localhost/api/tutors/block-slots", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  }) as unknown as Parameters<typeof DELETE>[0];
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
});

describe("GET /api/tutors/block-slots", () => {
  it("dado un visitante no autenticado, entonces devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("dado un usuario que no es tutor, entonces devuelve 403", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.isTutorSingle.mockResolvedValue({ data: { is_tutor: false } });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("dado un tutor, entonces devuelve sus bloqueos", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.isTutorSingle.mockResolvedValue({ data: { is_tutor: true } });
    h.blocksOrder.mockResolvedValue({
      data: [{ id: "b-1", starts_at: "x", ends_at: "y" }],
      error: null,
    });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.blocks).toHaveLength(1);
  });
});

describe("POST /api/tutors/block-slots", () => {
  beforeEach(() => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.isTutorSingle.mockResolvedValue({ data: { is_tutor: true } });
  });

  it("dado un usuario que no es tutor, entonces devuelve 403", async () => {
    h.isTutorSingle.mockResolvedValue({ data: { is_tutor: false } });
    const res = await POST(makePost({ type: "day", date: "2026-06-01" }));
    expect(res.status).toBe(403);
  });

  it("dado un body que no parsea JSON, entonces devuelve 400", async () => {
    const res = await POST(makePost(null, "no json"));
    expect(res.status).toBe(400);
  });

  it("dado un type inválido, entonces devuelve 400", async () => {
    const res = await POST(makePost({ type: "month", date: "2026-06-01" }));
    expect(res.status).toBe(400);
  });

  it("dado un type custom sin start_time, entonces devuelve 400", async () => {
    const res = await POST(makePost({ type: "custom", date: "2026-06-01" }));
    expect(res.status).toBe(400);
  });

  it("dado un type custom con end_time <= start_time, entonces devuelve 400", async () => {
    const res = await POST(
      makePost({
        type: "custom",
        date: "2026-06-01",
        start_time: "18:00",
        end_time: "14:00",
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/end_time/i);
  });

  it("dado un type day válido, entonces inserta el bloqueo y devuelve el row", async () => {
    h.insertSingle.mockResolvedValue({
      data: {
        id: "b-1",
        starts_at: "x",
        ends_at: "y",
        block_type: "day",
        reason: null,
      },
      error: null,
    });
    const res = await POST(makePost({ type: "day", date: "2026-06-01" }));
    expect(res.status).toBe(200);
    expect((await res.json()).block.id).toBe("b-1");
  });

  it("dado un body low-level con ends_at <= starts_at, entonces devuelve 400", async () => {
    const res = await POST(
      makePost({
        starts_at: "2026-06-01T18:00:00Z",
        ends_at: "2026-06-01T14:00:00Z",
      })
    );
    expect(res.status).toBe(400);
  });

  it("dado un body low-level válido, entonces inserta y devuelve el row", async () => {
    h.insertSingle.mockResolvedValue({
      data: { id: "b-2", starts_at: "x", ends_at: "y", block_type: "custom" },
      error: null,
    });
    const res = await POST(
      makePost({
        starts_at: "2026-06-01T14:00:00Z",
        ends_at: "2026-06-01T18:00:00Z",
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).block.id).toBe("b-2");
  });
});

describe("DELETE /api/tutors/block-slots", () => {
  beforeEach(() => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    h.isTutorSingle.mockResolvedValue({ data: { is_tutor: true } });
  });

  it("dado un usuario que no es tutor, entonces devuelve 403", async () => {
    h.isTutorSingle.mockResolvedValue({ data: { is_tutor: false } });
    const res = await DELETE(makeDelete({ block_id: "b-1" }));
    expect(res.status).toBe(403);
  });

  it("dado un body sin block_id, entonces devuelve 400", async () => {
    const res = await DELETE(makeDelete({}));
    expect(res.status).toBe(400);
  });

  it("dado un block_id que no le pertenece o no existe, entonces devuelve 404", async () => {
    h.deleteMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await DELETE(makeDelete({ block_id: "b-zzz" }));
    expect(res.status).toBe(404);
  });

  it("dado un block_id propio, entonces devuelve { deleted: true }", async () => {
    h.deleteMaybeSingle.mockResolvedValue({
      data: { id: "b-1" },
      error: null,
    });
    const res = await DELETE(makeDelete({ block_id: "b-1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
  });
});
