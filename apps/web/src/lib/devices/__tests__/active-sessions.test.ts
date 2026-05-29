import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActiveSession } from "@/lib/database.types";
import {
  activeDeviceCutoffIso,
  listActiveSessionsForUser,
  oldestSessionId,
} from "../active-sessions";

// Helper para construir sesiones con lo mínimo que usa la unidad (el id).
function session(id: string): ActiveSession {
  return { id } as ActiveSession;
}

describe("oldestSessionId", () => {
  it("devuelve el id de la primera sesión de la lista", () => {
    // given: las sesiones vienen ordenadas por last_seen_at ascendente,
    // así que la primera es la más antigua.
    const sessions = [session("vieja"), session("media"), session("nueva")];

    // when / then
    expect(oldestSessionId(sessions)).toBe("vieja");
  });

  it("devuelve el único id cuando hay una sola sesión", () => {
    expect(oldestSessionId([session("unica")])).toBe("unica");
  });

  it("devuelve null cuando la lista está vacía", () => {
    expect(oldestSessionId([])).toBeNull();
  });
});

describe("activeDeviceCutoffIso", () => {
  // Depende de Date.now() (dependencia externa: el reloj). Congelamos el tiempo
  // con fake timers para que el corte sea determinístico.
  const NOW = new Date("2026-05-28T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve el instante de hace 30 días en formato ISO", () => {
    // given: el corte de inactividad es de 30 días
    // when / then: 30 días antes de 2026-05-28 es 2026-04-28
    expect(activeDeviceCutoffIso()).toBe("2026-04-28T12:00:00.000Z");
  });
});

// Stub de la cadena Supabase usada por listActiveSessionsForUser:
// admin.from(table).select(...).eq(...).gte(...).order(...) -> { data, error }
function makeSupabaseStub(terminal: {
  data: unknown;
  error: { message: string } | null;
}): SupabaseClient {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: async () => terminal,
  };
  return {
    from: vi.fn(() => chain),
  } as unknown as SupabaseClient;
}

describe("listActiveSessionsForUser", () => {
  it("devuelve la lista de sesiones que entrega Supabase", async () => {
    // given
    const sessions = [
      { id: "s1", label: "Chrome en Windows" },
      { id: "s2", label: "Safari en macOS" },
    ];
    const admin = makeSupabaseStub({ data: sessions, error: null });

    // when
    const result = await listActiveSessionsForUser(admin, "user-1");

    // then
    expect(result).toEqual(sessions);
  });

  it("devuelve un array vacío cuando Supabase no trae datos", async () => {
    // given: data null (la unidad usa `data ?? []`)
    const admin = makeSupabaseStub({ data: null, error: null });

    // when
    const result = await listActiveSessionsForUser(admin, "user-1");

    // then
    expect(result).toEqual([]);
  });

  it("propaga el error de Supabase como excepción", async () => {
    // given
    const admin = makeSupabaseStub({
      data: null,
      error: { message: "permission denied" },
    });

    // when / then
    await expect(
      listActiveSessionsForUser(admin, "user-1")
    ).rejects.toThrow("permission denied");
  });
});
