import { describe, it, expect, beforeEach, vi } from "vitest";

// Estos notifiers resuelven contexto (pregunta -> material -> dueño/autor),
// resuelven emails/nombres y delegan el envío en sendTransactionalEmail. Lo
// mockeamos como spy para verificar a quién y con qué idempotencyKey se envía,
// sin pegarle a Resend. Los builders de templates se ejercitan de verdad.
const h = vi.hoisted(() => ({ sendTransactionalEmail: vi.fn() }));

vi.mock("../resend", () => ({
  sendTransactionalEmail: h.sendTransactionalEmail,
}));

import {
  notifyOwnerOfNewMaterialQuestion,
  notifyBuyersOfMaterialQuestionAnswer,
} from "../material-question-notifications";

type AdminData = {
  question?: Record<string, unknown> | null;
  resume?: Record<string, unknown> | null;
  course?: Record<string, unknown> | null;
  courseModule?: Record<string, unknown> | null;
  answer?: Record<string, unknown> | null;
  purchase?: Record<string, unknown> | null;
  meToos?: Array<{ user_id: string }>;
  validPurchases?: Array<{ buyer_id: string }>;
  validEnrollments?: Array<{ student_id: string }>;
  profilesById?: Record<string, { display_name: string | null }>;
  emailsById?: Record<string, string>;
};

function makeAdmin(data: AdminData) {
  const single: Record<string, unknown> = {
    material_questions: data.question ?? null,
    resumes: data.resume ?? null,
    recorded_courses: data.course ?? null,
    course_modules: data.courseModule ?? null,
    material_question_answers: data.answer ?? null,
    purchases: data.purchase ?? null,
  };
  const list: Record<string, unknown> = {
    material_question_me_toos: data.meToos ?? [],
    purchases: data.validPurchases ?? [],
    course_enrollments: data.validEnrollments ?? [],
  };

  function builder(table: string) {
    const filters: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return chain;
      },
      // Algunas queries (p.ej. me-toos) terminan en .eq() y se hace `await`
      // directo sobre la cadena: la hacemos thenable para resolver la lista.
      then: (resolve: (v: { data: unknown }) => void) =>
        resolve({ data: list[table] ?? [] }),
      in: async () => ({ data: list[table] ?? [] }),
      maybeSingle: async () => {
        if (table === "profiles") {
          return {
            data: data.profilesById?.[String(filters.id)] ?? null,
          };
        }
        return { data: single[table] ?? null };
      },
    };
    return chain;
  }

  return {
    auth: {
      admin: {
        getUserById: vi.fn(async (id: string) => {
          const email = data.emailsById?.[id];
          return email
            ? { data: { user: { email } }, error: null }
            : { data: { user: null }, error: null };
        }),
      },
    },
    from: vi.fn((table: string) => builder(table)),
  } as never;
}

const resumeQuestion = {
  id: "q-1",
  target_type: "resume",
  resume_id: "res-1",
  course_id: null,
  module_id: null,
  author_id: "student-1",
  anchor_page: 4,
  anchor_seconds: null,
  title: "¿Qué es una transacción ACID?",
  status: "open",
};

describe("notifyOwnerOfNewMaterialQuestion", () => {
  beforeEach(() => {
    h.sendTransactionalEmail.mockReset();
    // El código encadena .catch() sobre el resultado: debe ser una promesa.
    h.sendTransactionalEmail.mockResolvedValue({ id: "email-1" });
  });

  it("dado un apunte con dueño y email, entonces envía el aviso al dueño con la idempotencyKey de la pregunta", async () => {
    const admin = makeAdmin({
      question: resumeQuestion,
      resume: { title: "Bases de Datos I", seller_id: "seller-1" },
      emailsById: { "seller-1": "vendedor@test.com" },
      profilesById: {
        "seller-1": { display_name: "Profe Ana" },
        "student-1": { display_name: "Estu Lucas" },
      },
    });

    await notifyOwnerOfNewMaterialQuestion(admin, "q-1");

    expect(h.sendTransactionalEmail).toHaveBeenCalledTimes(1);
    const arg = h.sendTransactionalEmail.mock.calls[0][0];
    expect(arg.to).toBe("vendedor@test.com");
    expect(arg.idempotencyKey).toBe("material-question-new-q-1");
    expect(arg.subject).toBeTruthy();
  });

  it("dado que la pregunta no existe, entonces no envía nada", async () => {
    const admin = makeAdmin({ question: null });

    await notifyOwnerOfNewMaterialQuestion(admin, "q-inexistente");

    expect(h.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("dado que el dueño no tiene email, entonces no envía nada", async () => {
    const admin = makeAdmin({
      question: resumeQuestion,
      resume: { title: "Bases de Datos I", seller_id: "seller-1" },
      emailsById: {}, // sin email para seller-1
      profilesById: {},
    });

    await notifyOwnerOfNewMaterialQuestion(admin, "q-1");

    expect(h.sendTransactionalEmail).not.toHaveBeenCalled();
  });
});

describe("notifyBuyersOfMaterialQuestionAnswer", () => {
  beforeEach(() => {
    h.sendTransactionalEmail.mockReset();
    h.sendTransactionalEmail.mockResolvedValue({ id: "email-1" });
  });

  it("dada una respuesta sin me-too, entonces avisa solo al autor de la pregunta", async () => {
    const admin = makeAdmin({
      answer: { id: "ans-1", question_id: "q-1" },
      question: resumeQuestion,
      resume: { title: "Bases de Datos I", seller_id: "seller-1" },
      purchase: null, // buildResumeViewUrl cae a la URL pública del apunte
      meToos: [],
      emailsById: { "student-1": "estudiante@test.com" },
      profilesById: { "student-1": { display_name: "Estu Lucas" } },
    });

    await notifyBuyersOfMaterialQuestionAnswer(admin, "ans-1");

    expect(h.sendTransactionalEmail).toHaveBeenCalledTimes(1);
    const arg = h.sendTransactionalEmail.mock.calls[0][0];
    expect(arg.to).toBe("estudiante@test.com");
    expect(arg.idempotencyKey).toBe("material-answer-author-ans-1");
  });

  it("dada una respuesta inexistente, entonces no envía nada", async () => {
    const admin = makeAdmin({ answer: null });

    await notifyBuyersOfMaterialQuestionAnswer(admin, "ans-inexistente");

    expect(h.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("dado un me-too con compra válida, entonces avisa también al comprador (fase 2)", async () => {
    const admin = makeAdmin({
      answer: { id: "ans-1", question_id: "q-1" },
      question: resumeQuestion,
      resume: { title: "Bases de Datos I", seller_id: "seller-1" },
      purchase: null,
      meToos: [{ user_id: "buyer-2" }],
      validPurchases: [{ buyer_id: "buyer-2" }],
      emailsById: {
        "student-1": "estudiante@test.com",
        "buyer-2": "metoo@test.com",
      },
      profilesById: {
        "student-1": { display_name: "Estu Lucas" },
        "buyer-2": { display_name: "Otro Comprador" },
      },
    });

    await notifyBuyersOfMaterialQuestionAnswer(admin, "ans-1");

    // Autor + 1 me-tooer válido.
    expect(h.sendTransactionalEmail).toHaveBeenCalledTimes(2);
    const recipients = h.sendTransactionalEmail.mock.calls.map((c) => c[0].to);
    expect(recipients).toContain("estudiante@test.com");
    expect(recipients).toContain("metoo@test.com");
  });
});

const courseQuestion = {
  id: "q-2",
  target_type: "course",
  resume_id: null,
  course_id: "course-1",
  module_id: "module-1",
  author_id: "student-1",
  anchor_page: null,
  anchor_seconds: 125,
  title: "¿Qué pasa en este minuto del video?",
  status: "open",
};

describe("notifications — variante curso", () => {
  beforeEach(() => {
    h.sendTransactionalEmail.mockReset();
    h.sendTransactionalEmail.mockResolvedValue({ id: "email-1" });
  });

  it("avisa al dueño del curso de una consulta nueva (con módulo y minuto)", async () => {
    const admin = makeAdmin({
      question: courseQuestion,
      course: { title: "Curso de Álgebra", author_id: "seller-1" },
      courseModule: { title: "Vectores", position: 2 },
      emailsById: { "seller-1": "profe@test.com" },
      profilesById: {
        "seller-1": { display_name: "Profe Ana" },
        "student-1": { display_name: "Estu Lucas" },
      },
    });

    await notifyOwnerOfNewMaterialQuestion(admin, "q-2");

    expect(h.sendTransactionalEmail).toHaveBeenCalledTimes(1);
    expect(h.sendTransactionalEmail.mock.calls[0][0].idempotencyKey).toBe(
      "material-question-new-q-2"
    );
  });

  it("avisa al autor y a un me-tooer inscripto cuando se responde una consulta de curso", async () => {
    const admin = makeAdmin({
      answer: { id: "ans-2", question_id: "q-2" },
      question: courseQuestion,
      course: { title: "Curso de Álgebra", author_id: "seller-1" },
      courseModule: { title: "Vectores", position: 2 },
      meToos: [{ user_id: "buyer-9" }],
      validEnrollments: [{ student_id: "buyer-9" }],
      emailsById: {
        "student-1": "estudiante@test.com",
        "buyer-9": "metoo@test.com",
      },
      profilesById: {
        "student-1": { display_name: "Estu Lucas" },
        "buyer-9": { display_name: "Otro Alumno" },
      },
    });

    await notifyBuyersOfMaterialQuestionAnswer(admin, "ans-2");

    expect(h.sendTransactionalEmail).toHaveBeenCalledTimes(2);
    const recipients = h.sendTransactionalEmail.mock.calls.map((c) => c[0].to);
    expect(recipients).toContain("estudiante@test.com");
    expect(recipients).toContain("metoo@test.com");
  });
});
