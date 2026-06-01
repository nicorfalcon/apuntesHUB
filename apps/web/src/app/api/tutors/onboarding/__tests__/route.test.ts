import { describe, it, expect, beforeEach, vi } from "vitest";

// POST /api/tutors/onboarding: el usuario se da de alta como tutor (perfil +
// materias + disponibilidad). validateBody corre de verdad; mockeamos el admin
// client con un builder genérico para cubrir el camino feliz y las ramas de error.

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileError: { value: null as { message: string } | null },
  subjectError: { value: null as { message: string } | null },
  tutorSubjectError: { value: null as { message: string } | null },
  existingSubjects: { value: [] as Array<{ subject_id: string }> },
  availabilityError: { value: null as { message: string } | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/supabase/admin", () => {
  function builder(
    thenValue: unknown,
    single?: () => Promise<unknown>
  ) {
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.eq = () => c;
    c.in = () => c;
    c.upsert = () => c;
    c.update = () => c;
    c.delete = () => c;
    c.insert = () => c;
    c.single = single ?? (async () => ({ data: null, error: null }));
    c.then = (r: (v: unknown) => void) => r(thenValue);
    return c;
  }
  return {
    createAdminClient: () => ({
      from: (table: string) => {
        if (table === "profiles") return builder({ error: h.profileError.value });
        if (table === "subjects")
          return builder({}, async () => ({
            data: { id: "subj-1" },
            error: h.subjectError.value,
          }));
        if (table === "tutor_subjects")
          return builder({
            data: h.existingSubjects.value,
            error: h.tutorSubjectError.value,
          });
        // tutor_availability
        return builder({ error: h.availabilityError.value });
      },
    }),
  };
});

import { POST } from "../route";

const VALID_BODY = {
  bio: "Soy profe de matemática con varios años dando clases particulares.",
  subjects: [
    {
      name: "Cálculo",
      university: "UBA",
      career: "Ingeniería",
      hourly_rate_ars: 3000,
      approval_proof_url: null,
    },
  ],
  availability: [
    { day_of_week: 1, start_time: "14:00", end_time: "18:00", modality: "online" },
  ],
};

function makeReq(body: unknown) {
  return new Request("http://localhost/api/tutors/onboarding", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.getUser.mockReset();
  h.profileError.value = null;
  h.subjectError.value = null;
  h.tutorSubjectError.value = null;
  h.existingSubjects.value = [];
  h.availabilityError.value = null;
  h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("POST tutors/onboarding", () => {
  it("dado un body válido, da de alta al tutor (200)", async () => {
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });

  it("sin sesión devuelve 401", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(makeReq(VALID_BODY))).status).toBe(401);
  });

  it("con bio demasiado corta devuelve 400", async () => {
    expect((await POST(makeReq({ ...VALID_BODY, bio: "corta" }))).status).toBe(400);
  });

  it("sin materias devuelve 400", async () => {
    expect((await POST(makeReq({ ...VALID_BODY, subjects: [] }))).status).toBe(400);
  });

  it("con una tarifa inválida devuelve 400", async () => {
    const res = await POST(
      makeReq({
        ...VALID_BODY,
        subjects: [{ ...VALID_BODY.subjects[0], hourly_rate_ars: 0 }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("con un horario inválido (fin <= inicio) devuelve 400", async () => {
    const res = await POST(
      makeReq({
        ...VALID_BODY,
        availability: [
          { day_of_week: 1, start_time: "18:00", end_time: "14:00", modality: "online" },
        ],
      })
    );
    expect(res.status).toBe(400);
  });

  it("si falla la actualización del perfil devuelve 500", async () => {
    h.profileError.value = { message: "db" };
    expect((await POST(makeReq(VALID_BODY))).status).toBe(500);
  });

  it("si falla el guardado de una materia devuelve 500", async () => {
    h.subjectError.value = { message: "db" };
    expect((await POST(makeReq(VALID_BODY))).status).toBe(500);
  });

  it("si falla el guardado de los horarios devuelve 500", async () => {
    h.availabilityError.value = { message: "db" };
    expect((await POST(makeReq(VALID_BODY))).status).toBe(500);
  });
});
