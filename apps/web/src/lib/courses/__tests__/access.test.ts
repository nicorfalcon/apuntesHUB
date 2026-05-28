import { describe, it, expect, vi } from "vitest";
import {
  assertCourseModuleAccess,
  CourseModuleAccessError,
} from "../access";

type SupabaseArg = Parameters<typeof assertCourseModuleAccess>[0]["supabase"];

// El cliente Supabase es una dependencia externa (red + DB). Lo reemplazamos por
// un STUB: un objeto que imita la cadena .from().select().eq()...single() y
// devuelve los datos que cada test necesita. No verificamos cómo se lo llama
// (eso sería un spy/mock); solo nos importa el resultado del SUT ante distintos
// estados de la DB.
function makeSupabaseStub(opts: {
  course?: unknown;
  enrollment?: unknown;
}): SupabaseArg {
  const chainReturning = (terminal: { data: unknown }) => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      single: async () => terminal,
      maybeSingle: async () => terminal,
    };
    return chain;
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "recorded_courses") {
        return chainReturning({ data: opts.course ?? null });
      }
      if (table === "course_enrollments") {
        return chainReturning({ data: opts.enrollment ?? null });
      }
      throw new Error(`tabla inesperada en el stub: ${table}`);
    }),
  } as unknown as SupabaseArg;
}

// Curso de ejemplo con dos módulos desordenados por position.
const courseFixture = {
  id: "course-1",
  title: "Estructuras de Datos",
  author_id: "author-1",
  is_published: true,
  course_modules: [
    {
      id: "mod-b",
      position: 1,
      title: "Árboles",
      description: null,
      duration_seconds: 600,
      video_storage_key: "key-b",
    },
    {
      id: "mod-a",
      position: 0,
      title: "Introducción",
      description: null,
      duration_seconds: 300,
      video_storage_key: "key-a",
    },
  ],
};

describe("assertCourseModuleAccess", () => {
  describe("casos de error", () => {
    it("lanza 'unauthenticated' cuando no hay userId", async () => {
      // given
      const supabase = makeSupabaseStub({});

      // when / then
      await expect(
        assertCourseModuleAccess({
          supabase,
          userId: null,
          courseId: "course-1",
          moduleId: "mod-a",
        })
      ).rejects.toMatchObject({ code: "unauthenticated" });
    });

    it("lanza 'not_found' cuando el curso no existe", async () => {
      // given: la query del curso devuelve null
      const supabase = makeSupabaseStub({ course: null });

      // when / then
      await expect(
        assertCourseModuleAccess({
          supabase,
          userId: "author-1",
          courseId: "course-1",
          moduleId: "mod-a",
        })
      ).rejects.toMatchObject({ code: "not_found" });
    });

    it("lanza 'not_found' cuando el módulo no pertenece al curso", async () => {
      // given
      const supabase = makeSupabaseStub({ course: courseFixture });

      // when / then
      await expect(
        assertCourseModuleAccess({
          supabase,
          userId: "author-1",
          courseId: "course-1",
          moduleId: "modulo-inexistente",
        })
      ).rejects.toMatchObject({ code: "not_found" });
    });

    it("lanza 'forbidden' cuando un estudiante no tiene inscripción", async () => {
      // given: no es autor y la inscripción es null
      const supabase = makeSupabaseStub({
        course: courseFixture,
        enrollment: null,
      });

      // when / then
      await expect(
        assertCourseModuleAccess({
          supabase,
          userId: "student-99",
          courseId: "course-1",
          moduleId: "mod-a",
        })
      ).rejects.toMatchObject({ code: "forbidden" });
    });

    it("lanza 'forbidden' al autor si se exige inscripción y no la tiene", async () => {
      // given: es el autor pero requireEnrollment fuerza el chequeo
      const supabase = makeSupabaseStub({
        course: courseFixture,
        enrollment: null,
      });

      // when / then
      await expect(
        assertCourseModuleAccess({
          supabase,
          userId: "author-1",
          courseId: "course-1",
          moduleId: "mod-a",
          requireEnrollment: true,
        })
      ).rejects.toMatchObject({ code: "forbidden" });
    });

    it("el error lanzado es una instancia de CourseModuleAccessError", async () => {
      // given
      const supabase = makeSupabaseStub({});

      // when / then
      await expect(
        assertCourseModuleAccess({
          supabase,
          userId: null,
          courseId: "course-1",
          moduleId: "mod-a",
        })
      ).rejects.toBeInstanceOf(CourseModuleAccessError);
    });
  });

  describe("accesos permitidos", () => {
    it("permite al autor sin necesidad de inscripción", async () => {
      // given
      const supabase = makeSupabaseStub({ course: courseFixture });

      // when
      const result = await assertCourseModuleAccess({
        supabase,
        userId: "author-1",
        courseId: "course-1",
        moduleId: "mod-a",
      });

      // then
      expect(result.isAuthor).toBe(true);
      expect(result.enrollmentId).toBeNull();
      expect(result.module.id).toBe("mod-a");
    });

    it("permite al estudiante inscripto y devuelve su enrollmentId", async () => {
      // given
      const supabase = makeSupabaseStub({
        course: courseFixture,
        enrollment: { id: "enroll-1" },
      });

      // when
      const result = await assertCourseModuleAccess({
        supabase,
        userId: "student-1",
        courseId: "course-1",
        moduleId: "mod-b",
      });

      // then
      expect(result.isAuthor).toBe(false);
      expect(result.enrollmentId).toBe("enroll-1");
      expect(result.module.id).toBe("mod-b");
    });

    it("devuelve los módulos ordenados por position ascendente", async () => {
      // given: el fixture tiene los módulos desordenados (position 1 antes que 0)
      const supabase = makeSupabaseStub({ course: courseFixture });

      // when
      const result = await assertCourseModuleAccess({
        supabase,
        userId: "author-1",
        courseId: "course-1",
        moduleId: "mod-a",
      });

      // then
      expect(result.modules.map((m) => m.id)).toEqual(["mod-a", "mod-b"]);
    });
  });
});
