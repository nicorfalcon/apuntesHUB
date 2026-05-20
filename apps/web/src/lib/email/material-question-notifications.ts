import type { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "./resend";
import {
  buildBuyerMaterialQuestionAnsweredEmail,
  buildOwnerNewMaterialQuestionEmail,
} from "./templates";

type AdminClient = ReturnType<typeof createAdminClient>;

type MaterialKind = "resume" | "course";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://apunteshub.com";
}

function normalizeName(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

async function getUserEmail(admin: AdminClient, userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) return null;
  return data.user?.email ?? null;
}

async function getProfileName(
  admin: AdminClient,
  userId: string,
  fallback: string
) {
  const { data } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return normalizeName(data?.display_name, fallback);
}

function formatSecondsLabel(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

async function buildResumeViewUrl(
  admin: AdminClient,
  resumeId: string,
  buyerId: string
) {
  const { data } = await admin
    .from("purchases")
    .select("id")
    .eq("resume_id", resumeId)
    .eq("buyer_id", buyerId)
    .eq("status", "completed")
    .maybeSingle();
  if (!data) return `${appUrl()}/resume/${resumeId}`;
  return `${appUrl()}/my-purchases/${data.id}/view`;
}

function buildCourseViewUrl(courseId: string, moduleId: string | null) {
  if (moduleId) return `${appUrl()}/cursos/${courseId}/ver/${moduleId}`;
  return `${appUrl()}/cursos/${courseId}`;
}

interface QuestionContext {
  questionId: string;
  questionTitle: string;
  questionAuthorId: string;
  targetType: MaterialKind;
  materialTitle: string;
  materialOwnerId: string;
  contextLabel: string | null;
  resumeId: string | null;
  courseId: string | null;
  moduleId: string | null;
}

async function loadQuestionContext(
  admin: AdminClient,
  questionId: string
): Promise<QuestionContext | null> {
  const { data: question } = await admin
    .from("material_questions")
    .select(
      "id, target_type, resume_id, course_id, module_id, author_id, anchor_page, anchor_seconds, title, status"
    )
    .eq("id", questionId)
    .maybeSingle();

  if (!question) return null;

  const targetType = question.target_type as MaterialKind;
  let materialTitle = targetType === "course" ? "Curso" : "Apunte";
  let materialOwnerId: string | null = null;
  let moduleLabel: string | null = null;

  if (targetType === "resume" && question.resume_id) {
    const { data: resume } = await admin
      .from("resumes")
      .select("title, seller_id")
      .eq("id", question.resume_id)
      .maybeSingle();
    if (resume) {
      materialTitle = resume.title;
      materialOwnerId = resume.seller_id;
    }
  } else if (targetType === "course" && question.course_id) {
    const { data: course } = await admin
      .from("recorded_courses")
      .select("title, author_id")
      .eq("id", question.course_id)
      .maybeSingle();
    if (course) {
      materialTitle = course.title;
      materialOwnerId = course.author_id;
    }
    if (question.module_id) {
      const { data: courseModule } = await admin
        .from("course_modules")
        .select("title, position")
        .eq("id", question.module_id)
        .maybeSingle();
      if (courseModule) {
        moduleLabel = `Módulo ${courseModule.position}: ${courseModule.title}`;
      }
    }
  }

  if (!materialOwnerId) return null;

  const contextParts: string[] = [];
  if (targetType === "resume" && question.anchor_page) {
    contextParts.push(`Página ${question.anchor_page}`);
  }
  if (targetType === "course") {
    if (moduleLabel) contextParts.push(moduleLabel);
    if (question.anchor_seconds !== null && question.anchor_seconds !== undefined) {
      contextParts.push(`Minuto ${formatSecondsLabel(question.anchor_seconds)}`);
    }
  }

  return {
    questionId: question.id,
    questionTitle: question.title,
    questionAuthorId: question.author_id,
    targetType,
    materialTitle,
    materialOwnerId,
    contextLabel: contextParts.length > 0 ? contextParts.join(" · ") : null,
    resumeId: question.resume_id,
    courseId: question.course_id,
    moduleId: question.module_id,
  };
}

export async function notifyOwnerOfNewMaterialQuestion(
  admin: AdminClient,
  questionId: string
) {
  const ctx = await loadQuestionContext(admin, questionId);
  if (!ctx) return;

  const ownerEmail = await getUserEmail(admin, ctx.materialOwnerId);
  if (!ownerEmail) return;

  const [ownerName, studentName] = await Promise.all([
    getProfileName(admin, ctx.materialOwnerId, ctx.targetType === "course" ? "Profesor" : "Vendedor"),
    getProfileName(admin, ctx.questionAuthorId, "Estudiante"),
  ]);

  const dashboardUrl = `${appUrl()}/sell/dashboard?inventario=consultas`;
  const email = buildOwnerNewMaterialQuestionEmail({
    ownerName,
    studentName,
    materialKind: ctx.targetType,
    materialTitle: ctx.materialTitle,
    questionTitle: ctx.questionTitle,
    contextLabel: ctx.contextLabel,
    dashboardUrl,
  });

  await sendTransactionalEmail({
    to: ownerEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey: `material-question-new-${ctx.questionId}`,
  });
}

export async function notifyBuyersOfMaterialQuestionAnswer(
  admin: AdminClient,
  answerId: string
) {
  const { data: answer } = await admin
    .from("material_question_answers")
    .select("id, question_id")
    .eq("id", answerId)
    .maybeSingle();
  if (!answer) return;

  const ctx = await loadQuestionContext(admin, answer.question_id);
  if (!ctx) return;

  const viewUrl =
    ctx.targetType === "resume" && ctx.resumeId
      ? await buildResumeViewUrl(admin, ctx.resumeId, ctx.questionAuthorId)
      : ctx.targetType === "course" && ctx.courseId
        ? buildCourseViewUrl(ctx.courseId, ctx.moduleId)
        : null;
  if (!viewUrl) return;

  // 1. Email al autor original de la pregunta.
  const authorEmail = await getUserEmail(admin, ctx.questionAuthorId);
  if (authorEmail) {
    const authorName = await getProfileName(admin, ctx.questionAuthorId, "Estudiante");
    const email = buildBuyerMaterialQuestionAnsweredEmail({
      buyerName: authorName,
      materialKind: ctx.targetType,
      materialTitle: ctx.materialTitle,
      questionTitle: ctx.questionTitle,
      viewUrl,
      isMeTooReceiver: false,
    });

    await sendTransactionalEmail({
      to: authorEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: `material-answer-author-${answer.id}`,
    }).catch((error) => {
      console.warn("[material-question] author notify failed", error);
    });
  }

  // 2. Fase 2: avisar a compradores con me-too (excluyendo autor y owner).
  const { data: meTooRows } = await admin
    .from("material_question_me_toos")
    .select("user_id")
    .eq("question_id", ctx.questionId);

  const excluded = new Set<string>([ctx.questionAuthorId, ctx.materialOwnerId]);
  const meTooUserIds = ((meTooRows ?? []) as Array<{ user_id: string }>)
    .map((row) => row.user_id)
    .filter((id) => !excluded.has(id));

  if (meTooUserIds.length === 0) return;

  // Verificar que cada me-tooer todavía tenga compra/inscripción válida.
  const validUserIds: string[] = [];
  if (ctx.targetType === "resume" && ctx.resumeId) {
    const { data } = await admin
      .from("purchases")
      .select("buyer_id")
      .eq("resume_id", ctx.resumeId)
      .eq("status", "completed")
      .in("buyer_id", meTooUserIds);
    for (const row of (data ?? []) as Array<{ buyer_id: string }>) {
      validUserIds.push(row.buyer_id);
    }
  } else if (ctx.targetType === "course" && ctx.courseId) {
    const { data } = await admin
      .from("course_enrollments")
      .select("student_id")
      .eq("course_id", ctx.courseId)
      .eq("status", "completed")
      .in("student_id", meTooUserIds);
    for (const row of (data ?? []) as Array<{ student_id: string }>) {
      validUserIds.push(row.student_id);
    }
  }

  if (validUserIds.length === 0) return;

  await Promise.allSettled(
    validUserIds.map(async (userId) => {
      const email = await getUserEmail(admin, userId);
      if (!email) return;
      const name = await getProfileName(admin, userId, "Estudiante");
      const built = buildBuyerMaterialQuestionAnsweredEmail({
        buyerName: name,
        materialKind: ctx.targetType,
        materialTitle: ctx.materialTitle,
        questionTitle: ctx.questionTitle,
        viewUrl: ctx.targetType === "resume" && ctx.resumeId
          ? await buildResumeViewUrl(admin, ctx.resumeId, userId)
          : viewUrl,
        isMeTooReceiver: true,
      });

      return sendTransactionalEmail({
        to: email,
        subject: built.subject,
        html: built.html,
        text: built.text,
        idempotencyKey: `material-answer-metoo-${answer.id}-${userId}`,
      });
    })
  );
}
