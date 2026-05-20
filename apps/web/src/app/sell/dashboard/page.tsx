import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResumesList } from "./resumes-list";
import { CoursesList } from "./courses-list";
import { SellerDashboardWorkspace } from "./seller-dashboard-workspace";
import {
  OwnerMaterialQuestionsManager,
  type OwnerMaterialQuestionItem,
} from "@/components/material-questions";

type DashboardQuestionRow = {
  id: string;
  target_type: "resume" | "course";
  resume_id: string | null;
  course_id: string | null;
  module_id: string | null;
  author_id: string;
  anchor_page: number | null;
  anchor_seconds: number | null;
  title: string;
  body: string;
  status: "open" | "answered" | "resolved" | "hidden";
  created_at: string;
};

type DashboardAnswerRow = {
  id: string;
  question_id: string;
};

type DashboardProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

function countRowsByKey<T extends Record<string, string | null>>(
  rows: T[],
  key: keyof T
) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const id = row[key];
    if (typeof id !== "string") continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/sell/dashboard");

  const admin = createAdminClient();

  const [
    { data: resumes },
    { data: purchases },
    { data: mpCreds },
    { data: courses },
    { data: enrollments },
    { data: bookings },
    { data: profile },
    { data: ingestionJobs },
  ] = await Promise.all([
    supabase
      .from("resumes")
      .select("*")
      .eq("seller_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("purchases")
      .select("amount, seller_amount, resume_id")
      .eq("seller_id", user.id)
      .eq("status", "completed"),
    admin
      .from("seller_mp_credentials")
      .select("id")
      .eq("id", user.id)
      .single(),
    admin
      .from("recorded_courses")
      .select("id, title, price_ars, is_published, deleted_at, rating_avg, rating_count, created_at, cover_color, cover_image_url, course_modules(id, position, title, video_storage_key)")
      .eq("author_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    admin
      .from("course_enrollments")
      .select("course_id, amount, seller_amount, recorded_courses!inner(author_id)")
      .eq("recorded_courses.author_id", user.id)
      .eq("status", "completed"),
    supabase
      .from("tutor_bookings")
      .select(
        "id, scheduled_at, duration_minutes, hourly_rate_ars, amount, status, modality, meeting_url, location_details, initial_message, student_id, subjects(name), profiles!student_id(display_name)"
      )
      .eq("tutor_id", user.id)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from("profiles")
      .select("is_tutor, tutor_bio")
      .eq("id", user.id)
      .single(),
    supabase
      .from("ingestion_jobs")
      .select("resume_id, status, chunks_generated"),
  ]);

  const hasMpConnected = !!mpCreds;

  // Stats: apuntes
  const totalApuntes = resumes?.length ?? 0;
  const totalVentasApuntes = purchases?.length ?? 0;
  const ingresosApuntes =
    purchases?.reduce((sum, p) => sum + Number(p.seller_amount), 0) ?? 0;

  const ventasPorResume: Record<string, number> = {};
  const ingresosPorResume: Record<string, number> = {};
  purchases?.forEach((p) => {
    ventasPorResume[p.resume_id] = (ventasPorResume[p.resume_id] ?? 0) + 1;
    ingresosPorResume[p.resume_id] =
      (ingresosPorResume[p.resume_id] ?? 0) + Number(p.seller_amount);
  });

  // Stats: cursos grabados
  const totalCursos = courses?.length ?? 0;
  const totalVentasCursos = enrollments?.length ?? 0;
  const ingresosCursos =
    enrollments?.reduce((sum, e) => sum + Number(e.seller_amount), 0) ?? 0;

  const ventasPorCurso: Record<string, number> = {};
  const ingresosPorCurso: Record<string, number> = {};
  enrollments?.forEach((e) => {
    ventasPorCurso[e.course_id] = (ventasPorCurso[e.course_id] ?? 0) + 1;
    ingresosPorCurso[e.course_id] =
      (ingresosPorCurso[e.course_id] ?? 0) + Number(e.seller_amount);
  });

  const resumeIds = (resumes ?? []).map((resume) => resume.id);
  const courseIds = (courses ?? []).map((course) => course.id);
  const [resumeQuestionResult, courseQuestionResult] = await Promise.all([
    resumeIds.length > 0
      ? admin
          .from("material_questions")
          .select(
            "id, target_type, resume_id, course_id, module_id, author_id, anchor_page, anchor_seconds, title, body, status, created_at"
          )
          .in("resume_id", resumeIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    courseIds.length > 0
      ? admin
          .from("material_questions")
          .select(
            "id, target_type, resume_id, course_id, module_id, author_id, anchor_page, anchor_seconds, title, body, status, created_at"
          )
          .in("course_id", courseIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const materialQuestionRows = [
    ...((resumeQuestionResult.data ?? []) as DashboardQuestionRow[]),
    ...((courseQuestionResult.data ?? []) as DashboardQuestionRow[]),
  ].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const materialQuestionIds = materialQuestionRows.map((question) => question.id);
  const [{ data: materialAnswers }, { data: materialMeToos }] =
    await Promise.all([
      materialQuestionIds.length > 0
        ? admin
            .from("material_question_answers")
            .select("id, question_id")
            .in("question_id", materialQuestionIds)
        : Promise.resolve({ data: [] }),
      materialQuestionIds.length > 0
        ? admin
            .from("material_question_me_toos")
            .select("question_id")
            .in("question_id", materialQuestionIds)
        : Promise.resolve({ data: [] }),
    ]);

  const dashboardAnswers = (materialAnswers ?? []) as DashboardAnswerRow[];
  const answerIds = dashboardAnswers.map((answer) => answer.id);
  const [{ data: materialHelpfulVotes }, { data: studentProfiles }] =
    await Promise.all([
      answerIds.length > 0
        ? admin
            .from("material_answer_helpful_votes")
            .select("answer_id")
            .in("answer_id", answerIds)
        : Promise.resolve({ data: [] }),
      materialQuestionRows.length > 0
        ? admin
            .from("profiles")
            .select("id, display_name, avatar_url")
            .in(
              "id",
              Array.from(new Set(materialQuestionRows.map((question) => question.author_id)))
            )
        : Promise.resolve({ data: [] }),
    ]);

  const answersByQuestion = countRowsByKey(dashboardAnswers, "question_id");
  const meToosByQuestion = countRowsByKey(
    ((materialMeToos ?? []) as Array<{ question_id: string }>),
    "question_id"
  );
  const helpfulByAnswer = countRowsByKey(
    ((materialHelpfulVotes ?? []) as Array<{ answer_id: string }>),
    "answer_id"
  );
  const helpfulByQuestion = new Map<string, number>();
  for (const answer of dashboardAnswers) {
    helpfulByQuestion.set(
      answer.question_id,
      (helpfulByQuestion.get(answer.question_id) ?? 0) +
        (helpfulByAnswer.get(answer.id) ?? 0)
    );
  }

  const profilesById = new Map(
    ((studentProfiles ?? []) as DashboardProfileRow[]).map((profile) => [
      profile.id,
      profile,
    ])
  );
  const resumesById = new Map((resumes ?? []).map((resume) => [resume.id, resume]));
  const coursesById = new Map((courses ?? []).map((course) => [course.id, course]));
  const modulesById = new Map<
    string,
    { id: string; title: string; position: number; course_id?: string }
  >();
  for (const course of courses ?? []) {
    for (const courseModule of course.course_modules ?? []) {
      modulesById.set(courseModule.id, courseModule);
    }
  }

  const materialQuestionsForOwner: OwnerMaterialQuestionItem[] =
    materialQuestionRows.map((question) => {
      const profile = profilesById.get(question.author_id);
      const courseModule = question.module_id ? modulesById.get(question.module_id) : null;
      const material =
        question.target_type === "resume" && question.resume_id
          ? resumesById.get(question.resume_id)
          : question.course_id
            ? coursesById.get(question.course_id)
            : null;

      return {
        id: question.id,
        targetType: question.target_type,
        status: question.status,
        title: question.title,
        body: question.body,
        createdAt: question.created_at,
        anchorPage: question.anchor_page,
        anchorSeconds: question.anchor_seconds,
        material: {
          id: question.resume_id ?? question.course_id ?? "",
          title: material?.title ?? "Material",
        },
        module: courseModule
          ? {
              id: courseModule.id,
              title: courseModule.title,
              position: courseModule.position,
            }
          : null,
        student: {
          id: question.author_id,
          displayName: profile?.display_name?.trim() || "Estudiante",
          avatarUrl: profile?.avatar_url ?? null,
        },
        counts: {
          meToo: meToosByQuestion.get(question.id) ?? 0,
          helpful: helpfulByQuestion.get(question.id) ?? 0,
          answers: answersByQuestion.get(question.id) ?? 0,
        },
      };
    });

  // Stats: tutorías
  const completedBookings =
    bookings?.filter((b) => b.status === "completed") ?? [];
  const totalTutorias = completedBookings.length;
  const ingresosTutorias = completedBookings.reduce(
    (sum, b) => sum + ((b.hourly_rate_ars ?? 0) * (b.duration_minutes ?? 60)) / 60,
    0
  );

  const ingestionStatuses: Record<string, "pending" | "processing" | "done" | "failed"> = {};
  ingestionJobs?.forEach((j) => {
    ingestionStatuses[j.resume_id] = j.status;
  });

  const isTutor = profile?.is_tutor ?? false;
  const showTutorSection = isTutor || (bookings?.length ?? 0) > 0;

  return (
    <SellerDashboardWorkspace
      hasMpConnected={hasMpConnected}
      showTutorSection={showTutorSection}
      isTutor={isTutor}
      totalApuntes={totalApuntes}
      totalCursos={totalCursos}
      totalVentasApuntes={totalVentasApuntes}
      totalVentasCursos={totalVentasCursos}
      totalTutorias={totalTutorias}
      totalConsultas={materialQuestionsForOwner.length}
      totalConsultasPendientes={
        materialQuestionsForOwner.filter((question) => question.status === "open").length
      }
      ingresosApuntes={ingresosApuntes}
      ingresosCursos={ingresosCursos}
      ingresosTutorias={ingresosTutorias}
      apuntesContent={
        <ResumesList
          resumes={resumes ?? []}
          ventasPorResume={ventasPorResume}
          ingresosPorResume={ingresosPorResume}
          ingestionStatuses={ingestionStatuses}
        />
      }
      cursosContent={
        <CoursesList
          userId={user.id}
          courses={courses ?? []}
          ventasPorCurso={ventasPorCurso}
          ingresosPorCurso={ingresosPorCurso}
        />
      }
      consultasContent={
        <OwnerMaterialQuestionsManager questions={materialQuestionsForOwner} />
      }
    />
  );
}
