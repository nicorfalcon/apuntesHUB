import { describe, it, expect, vi } from "vitest";
import {
  resolveQuestionAuthor,
  getResumeQuestionAccess,
  getCourseQuestionAccess,
  getQuestionAccess,
  canViewResumeQuestions,
  canAskResumeQuestion,
  canAnswerResumeQuestion,
  canViewCourseQuestions,
  canAskCourseQuestion,
  canAnswerCourseQuestion,
  validateCourseModuleBelongsToCourse,
  type MaterialQuestionsClient,
  type QuestionAuthorProfile,
} from "../index";

// El cliente Supabase es una dependencia externa (red + DB). Lo reemplazamos por
// un STUB: imita la cadena .from(tabla).select().eq()...maybeSingle() y devuelve
// los datos que cada test necesita según la tabla consultada. No verificamos cómo
// se lo llama (eso sería spy/mock); solo nos importa el resultado del SUT ante
// distintos estados de la DB.
function makeSupabaseStub(
  tables: Record<string, unknown>
): MaterialQuestionsClient {
  const chainFor = (table: string) => {
    const terminal = { data: tables[table] ?? null };
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => terminal,
      single: async () => terminal,
    };
    return chain;
  };

  return {
    from: vi.fn((table: string) => chainFor(table)),
  } as unknown as MaterialQuestionsClient;
}

describe("resolveQuestionAuthor", () => {
  const profile: QuestionAuthorProfile = {
    id: "user-1",
    display_name: "Juan Pérez",
    avatar_url: "https://avatar/1.png",
  };

  it("oculta la identidad cuando es anónimo y el viewer no puede ver la real", () => {
    // when
    const result = resolveQuestionAuthor({
      profile,
      isAnonymousToBuyers: true,
      viewerCanSeeRealIdentity: false,
    });

    // then
    expect(result).toEqual({
      id: null,
      displayName: "Estudiante anónimo",
      avatarUrl: null,
      isAnonymous: true,
    });
  });

  it("muestra la identidad real al viewer autorizado (ej. moderador) aunque sea anónimo", () => {
    // when
    const result = resolveQuestionAuthor({
      profile,
      isAnonymousToBuyers: true,
      viewerCanSeeRealIdentity: true,
    });

    // then
    expect(result.isAnonymous).toBe(false);
    expect(result.displayName).toBe("Juan Pérez");
    expect(result.id).toBe("user-1");
  });

  it("usa el fallback 'Estudiante' cuando el perfil no tiene nombre", () => {
    // given: perfil sin display_name
    const result = resolveQuestionAuthor({
      profile: { id: "u", display_name: "  ", avatar_url: null },
      isAnonymousToBuyers: false,
      viewerCanSeeRealIdentity: false,
    });

    // then
    expect(result.displayName).toBe("Estudiante");
    expect(result.isAnonymous).toBe(false);
  });
});

describe("getResumeQuestionAccess", () => {
  it("devuelve acceso vacío cuando el apunte no existe", async () => {
    // given: la query de resumes devuelve null
    const supabase = makeSupabaseStub({ resumes: null });

    // when
    const access = await getResumeQuestionAccess(supabase, "user-1", "resume-1");

    // then
    expect(access.exists).toBe(false);
    expect(access.canView).toBe(false);
  });

  it("da permisos de dueño (responder y moderar) al seller del apunte", async () => {
    // given: el apunte pertenece al usuario, sin compra
    const supabase = makeSupabaseStub({
      resumes: { id: "resume-1", seller_id: "user-1" },
      purchases: null,
    });

    // when
    const access = await getResumeQuestionAccess(supabase, "user-1", "resume-1");

    // then
    expect(access.isOwner).toBe(true);
    expect(access.canAnswer).toBe(true);
    expect(access.canModerate).toBe(true);
    expect(access.canView).toBe(true);
    expect(access.canAsk).toBe(false); // el dueño no "compra" su apunte
  });

  it("da permisos de comprador (preguntar y reaccionar) a quien compró", async () => {
    // given: no es dueño pero tiene compra completada
    const supabase = makeSupabaseStub({
      resumes: { id: "resume-1", seller_id: "otro" },
      purchases: { id: "purchase-1" },
    });

    // when
    const access = await getResumeQuestionAccess(supabase, "buyer-1", "resume-1");

    // then
    expect(access.isOwner).toBe(false);
    expect(access.canAsk).toBe(true);
    expect(access.canReact).toBe(true);
    expect(access.canView).toBe(true);
    expect(access.canAnswer).toBe(false);
    expect(access.canModerate).toBe(false);
  });

  it("niega todo a un tercero sin compra", async () => {
    // given: ni dueño ni comprador
    const supabase = makeSupabaseStub({
      resumes: { id: "resume-1", seller_id: "otro" },
      purchases: null,
    });

    // when
    const access = await getResumeQuestionAccess(supabase, "tercero", "resume-1");

    // then
    expect(access.exists).toBe(true);
    expect(access.canView).toBe(false);
    expect(access.canAsk).toBe(false);
  });
});

describe("getCourseQuestionAccess", () => {
  it("da permisos de dueño al autor del curso", async () => {
    // given
    const supabase = makeSupabaseStub({
      recorded_courses: { id: "course-1", author_id: "author-1" },
      course_enrollments: null,
    });

    // when
    const access = await getCourseQuestionAccess(supabase, "author-1", "course-1");

    // then
    expect(access.isOwner).toBe(true);
    expect(access.canAnswer).toBe(true);
  });

  it("da permisos de comprador al estudiante inscripto", async () => {
    // given
    const supabase = makeSupabaseStub({
      recorded_courses: { id: "course-1", author_id: "otro" },
      course_enrollments: { id: "enroll-1" },
    });

    // when
    const access = await getCourseQuestionAccess(supabase, "student-1", "course-1");

    // then
    expect(access.canAsk).toBe(true);
    expect(access.canReact).toBe(true);
  });

  it("devuelve acceso vacío cuando el curso no existe", async () => {
    const supabase = makeSupabaseStub({ recorded_courses: null });
    const access = await getCourseQuestionAccess(supabase, "user-1", "course-1");
    expect(access.exists).toBe(false);
  });
});

describe("getQuestionAccess", () => {
  it("devuelve acceso vacío y question null cuando la pregunta no existe", async () => {
    // given
    const supabase = makeSupabaseStub({ material_questions: null });

    // when
    const access = await getQuestionAccess(supabase, "user-1", "q-1");

    // then
    expect(access.question).toBeNull();
    expect(access.isQuestionAuthor).toBe(false);
    expect(access.canView).toBe(false);
  });

  it("permite ver una pregunta abierta al comprador del apunte", async () => {
    // given: pregunta open sobre un resume que el usuario compró
    const supabase = makeSupabaseStub({
      material_questions: {
        id: "q-1",
        target_type: "resume",
        resume_id: "resume-1",
        course_id: null,
        module_id: null,
        author_id: "otro",
        status: "open",
      },
      resumes: { id: "resume-1", seller_id: "seller-1" },
      purchases: { id: "purchase-1" },
    });

    // when
    const access = await getQuestionAccess(supabase, "buyer-1", "q-1");

    // then
    expect(access.canView).toBe(true);
    expect(access.canReact).toBe(true);
    expect(access.question?.status).toBe("open");
  });

  it("oculta una pregunta 'hidden' a un comprador que no es moderador ni autor", async () => {
    // given: pregunta hidden; el usuario compró (canView normal) pero no modera ni la escribió
    const supabase = makeSupabaseStub({
      material_questions: {
        id: "q-1",
        target_type: "resume",
        resume_id: "resume-1",
        course_id: null,
        module_id: null,
        author_id: "otro",
        status: "hidden",
      },
      resumes: { id: "resume-1", seller_id: "seller-1" },
      purchases: { id: "purchase-1" },
    });

    // when
    const access = await getQuestionAccess(supabase, "buyer-1", "q-1");

    // then: no puede ver la oculta, ni responder ni reaccionar
    expect(access.canView).toBe(false);
    expect(access.canReact).toBe(false);
    expect(access.canAnswer).toBe(false);
  });

  it("permite ver una pregunta 'hidden' al moderador (dueño del apunte)", async () => {
    // given: pregunta hidden sobre un resume cuyo dueño es el viewer
    const supabase = makeSupabaseStub({
      material_questions: {
        id: "q-1",
        target_type: "resume",
        resume_id: "resume-1",
        course_id: null,
        module_id: null,
        author_id: "otro",
        status: "hidden",
      },
      resumes: { id: "resume-1", seller_id: "owner-1" },
      purchases: null,
    });

    // when
    const access = await getQuestionAccess(supabase, "owner-1", "q-1");

    // then: el moderador ve la oculta, pero no puede responder/reaccionar sobre hidden
    expect(access.canView).toBe(true);
    expect(access.canAnswer).toBe(false);
    expect(access.canReact).toBe(false);
  });

  it("permite al autor de la pregunta ver su propia pregunta oculta", async () => {
    // given: pregunta hidden cuyo author_id es el viewer (no es dueño del apunte)
    const supabase = makeSupabaseStub({
      material_questions: {
        id: "q-1",
        target_type: "resume",
        resume_id: "resume-1",
        course_id: null,
        module_id: null,
        author_id: "autor-pregunta",
        status: "hidden",
      },
      resumes: { id: "resume-1", seller_id: "otro" },
      purchases: { id: "purchase-1" },
    });

    // when
    const access = await getQuestionAccess(supabase, "autor-pregunta", "q-1");

    // then
    expect(access.isQuestionAuthor).toBe(true);
    expect(access.canView).toBe(true);
  });
});

// Los seis wrappers `canX...` son atajos que reutilizan get*Access y exponen un
// solo permiso. Cubrimos un caso TRUE y uno FALSE de cada uno para dejar claro
// el contrato y atrapar inversiones accidentales en futuros cambios.
describe("wrappers can* (resume)", () => {
  it("canViewResumeQuestions true para el dueño", async () => {
    const supabase = makeSupabaseStub({
      resumes: { id: "r1", seller_id: "owner" },
      purchases: null,
    });
    expect(await canViewResumeQuestions(supabase, "owner", "r1")).toBe(true);
  });

  it("canViewResumeQuestions false para un tercero sin compra", async () => {
    const supabase = makeSupabaseStub({
      resumes: { id: "r1", seller_id: "otro" },
      purchases: null,
    });
    expect(await canViewResumeQuestions(supabase, "tercero", "r1")).toBe(false);
  });

  it("canAskResumeQuestion true para el comprador", async () => {
    const supabase = makeSupabaseStub({
      resumes: { id: "r1", seller_id: "otro" },
      purchases: { id: "p1" },
    });
    expect(await canAskResumeQuestion(supabase, "buyer", "r1")).toBe(true);
  });

  it("canAskResumeQuestion false para el dueño (no compra su propio apunte)", async () => {
    const supabase = makeSupabaseStub({
      resumes: { id: "r1", seller_id: "owner" },
      purchases: null,
    });
    expect(await canAskResumeQuestion(supabase, "owner", "r1")).toBe(false);
  });

  it("canAnswerResumeQuestion true para el dueño y false para el comprador", async () => {
    const supabaseOwner = makeSupabaseStub({
      resumes: { id: "r1", seller_id: "owner" },
      purchases: null,
    });
    expect(await canAnswerResumeQuestion(supabaseOwner, "owner", "r1")).toBe(true);

    const supabaseBuyer = makeSupabaseStub({
      resumes: { id: "r1", seller_id: "otro" },
      purchases: { id: "p1" },
    });
    expect(await canAnswerResumeQuestion(supabaseBuyer, "buyer", "r1")).toBe(false);
  });
});

describe("wrappers can* (course)", () => {
  it("canViewCourseQuestions true para el autor del curso", async () => {
    const supabase = makeSupabaseStub({
      recorded_courses: { id: "c1", author_id: "author" },
      course_enrollments: null,
    });
    expect(await canViewCourseQuestions(supabase, "author", "c1")).toBe(true);
  });

  it("canAskCourseQuestion true para el estudiante inscripto", async () => {
    const supabase = makeSupabaseStub({
      recorded_courses: { id: "c1", author_id: "otro" },
      course_enrollments: { id: "e1" },
    });
    expect(await canAskCourseQuestion(supabase, "student", "c1")).toBe(true);
  });

  it("canAnswerCourseQuestion false para un estudiante (solo el autor responde)", async () => {
    const supabase = makeSupabaseStub({
      recorded_courses: { id: "c1", author_id: "otro" },
      course_enrollments: { id: "e1" },
    });
    expect(await canAnswerCourseQuestion(supabase, "student", "c1")).toBe(false);
  });
});

describe("validateCourseModuleBelongsToCourse", () => {
  it("devuelve true cuando el módulo existe en el curso indicado", async () => {
    // given: la query encuentra el módulo
    const supabase = makeSupabaseStub({
      course_modules: { id: "mod-1" },
    });

    // when / then
    expect(
      await validateCourseModuleBelongsToCourse(supabase, "c1", "mod-1")
    ).toBe(true);
  });

  it("devuelve false cuando el módulo no pertenece al curso", async () => {
    // given: la query no encuentra nada
    const supabase = makeSupabaseStub({ course_modules: null });

    // when / then
    expect(
      await validateCourseModuleBelongsToCourse(supabase, "c1", "mod-x")
    ).toBe(false);
  });
});
