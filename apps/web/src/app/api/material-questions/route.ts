import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getCourseQuestionAccess,
  getResumeQuestionAccess,
  resolveQuestionAuthor,
  validateCourseModuleBelongsToCourse,
  type MaterialQuestionStatus,
  type MaterialQuestionsClient,
  type MaterialTargetType,
} from "@/lib/material-questions";
import { notifyOwnerOfNewMaterialQuestion } from "@/lib/email/material-question-notifications";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MaterialQuestionRow = {
  id: string;
  target_type: string;
  resume_id: string | null;
  course_id: string | null;
  module_id: string | null;
  anchor_page: number | null;
  anchor_seconds: number | null;
  author_id: string;
  title: string;
  body: string;
  is_anonymous_to_buyers: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

type MaterialAnswerRow = {
  id: string;
  question_id: string;
  author_id: string;
  body: string;
  is_official: boolean;
  created_at: string;
};

type MaterialFollowupRow = {
  id: string;
  question_id: string;
  author_id: string;
  role: string;
  body: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function optionalPositiveInteger(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return NaN;
  return number;
}

function optionalNonNegativeInteger(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) return NaN;
  return number;
}

const SEARCH_QUERY_MAX = 200;
const STATUS_FILTERS = new Set(["all", "open", "answered", "resolved", "hidden"]);
const SORT_OPTIONS = new Set([
  "default",
  "recent",
  "most_me_too",
  "answered_first",
  "unresolved_first",
]);

function escapeIlikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function validateText(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== "string") {
    return { value: "", error: `${label} requerido.` };
  }

  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    return {
      value: trimmed,
      error: `${label} debe tener entre ${min} y ${max} caracteres.`,
    };
  }

  return { value: trimmed, error: null };
}

function countById(rows: Array<{ id: string }>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
  }
  return counts;
}

function normalizeProfileRows(rows: ProfileRow[] | null) {
  return new Map((rows ?? []).map((profile) => [profile.id, profile]));
}

function profileDisplayName(profile: ProfileRow | undefined, fallback: string) {
  const name = profile?.display_name?.trim();
  return name && name.length > 0 ? name : fallback;
}

export async function GET(request: NextRequest) {
  const supabase = (await createClient()) as MaterialQuestionsClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("No autorizado", 401);

  const admin = createAdminClient() as MaterialQuestionsClient;
  const { searchParams } = request.nextUrl;
  const target = searchParams.get("target") as MaterialTargetType | null;

  if (target !== "resume" && target !== "course") {
    return jsonError("target debe ser resume o course.", 400);
  }

  const currentPage = optionalPositiveInteger(searchParams.get("current_page"));
  if (Number.isNaN(currentPage)) {
    return jsonError("current_page debe ser mayor a 0.", 400);
  }

  const PAGE_SIZE_DEFAULT = 20;
  const PAGE_SIZE_MAX = 50;
  const pageParam = optionalPositiveInteger(searchParams.get("page"));
  if (Number.isNaN(pageParam)) {
    return jsonError("page debe ser mayor a 0.", 400);
  }
  const pageSizeParam = optionalPositiveInteger(searchParams.get("pageSize"));
  if (Number.isNaN(pageSizeParam)) {
    return jsonError("pageSize debe ser mayor a 0.", 400);
  }
  const requestedPage = pageParam ?? 1;
  const requestedPageSize = Math.min(pageSizeParam ?? PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);

  const rawQuery = (searchParams.get("q") ?? "").trim().slice(0, SEARCH_QUERY_MAX);
  const statusFilter = (searchParams.get("status") ?? "all").toLowerCase();
  if (!STATUS_FILTERS.has(statusFilter)) {
    return jsonError("status inválido.", 400);
  }
  const sortOption = (searchParams.get("sort") ?? "default").toLowerCase();
  if (!SORT_OPTIONS.has(sortOption)) {
    return jsonError("sort inválido.", 400);
  }

  let access;
  let query = admin
    .from("material_questions")
    .select(
      "id, target_type, resume_id, course_id, module_id, anchor_page, anchor_seconds, author_id, title, body, is_anonymous_to_buyers, status, created_at, updated_at"
    )
    .eq("target_type", target)
    .order("created_at", { ascending: false });

  if (target === "resume") {
    const resumeId = searchParams.get("resume_id");
    if (!isUuid(resumeId)) return jsonError("resume_id inválido.", 400);

    access = await getResumeQuestionAccess(admin, user.id, resumeId);
    if (!access.exists) return jsonError("Apunte no encontrado.", 404);
    query = query.eq("resume_id", resumeId);
  } else {
    const courseId = searchParams.get("course_id");
    const moduleId = searchParams.get("module_id");
    if (!isUuid(courseId)) return jsonError("course_id inválido.", 400);
    if (moduleId && !isUuid(moduleId)) return jsonError("module_id inválido.", 400);

    access = await getCourseQuestionAccess(admin, user.id, courseId);
    if (!access.exists) return jsonError("Curso no encontrado.", 404);
    query = query.eq("course_id", courseId);
    if (moduleId) query = query.eq("module_id", moduleId);
  }

  if (statusFilter === "hidden" && !access.canModerate) {
    return jsonError("No podés filtrar consultas ocultas.", 403);
  }

  if (access.canModerate) {
    // Dueño/autor ve también ocultas para auditoría.
  } else if (access.canView) {
    query = query.or(`status.neq.hidden,author_id.eq.${user.id}`);
  } else {
    query = query.eq("author_id", user.id);
  }

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (rawQuery.length > 0) {
    const pattern = `%${escapeIlikePattern(rawQuery)}%`;
    const quoted = pattern.replace(/"/g, '\\"');
    query = query.or(`title.ilike."${quoted}",body.ilike."${quoted}"`);
  }

  const { data: questionRows, error: questionsError } = await query;
  if (questionsError) return jsonError(questionsError.message, 500);

  const allQuestions = (questionRows ?? []) as MaterialQuestionRow[];
  if (!access.canView && allQuestions.length === 0) {
    return jsonError("No tenés acceso a las consultas de este material.", 403);
  }

  // Pre-cargar me-too totals para el sort (sin sub-resources pesados todavía).
  const allQuestionIds = allQuestions.map((question) => question.id);
  const meTooTotalsByQuestion = new Map<string, number>();
  if (allQuestionIds.length > 0) {
    const { data: allMeTooRows } = await admin
      .from("material_question_me_toos")
      .select("question_id")
      .in("question_id", allQuestionIds);
    for (const row of (allMeTooRows ?? []) as Array<{ question_id: string }>) {
      meTooTotalsByQuestion.set(
        row.question_id,
        (meTooTotalsByQuestion.get(row.question_id) ?? 0) + 1
      );
    }
  }

  const recentCmp = (a: MaterialQuestionRow, b: MaterialQuestionRow) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  const meTooCmp = (a: MaterialQuestionRow, b: MaterialQuestionRow) =>
    (meTooTotalsByQuestion.get(b.id) ?? 0) - (meTooTotalsByQuestion.get(a.id) ?? 0);
  const answeredScore = (row: MaterialQuestionRow) =>
    row.status === "answered" || row.status === "resolved" ? 1 : 0;
  const openScore = (row: MaterialQuestionRow) => (row.status === "open" ? 1 : 0);

  const sortedAll = [...allQuestions].sort((a, b) => {
    const aPageMatch = currentPage !== null && a.anchor_page === currentPage ? 1 : 0;
    const bPageMatch = currentPage !== null && b.anchor_page === currentPage ? 1 : 0;
    if (aPageMatch !== bPageMatch) return bPageMatch - aPageMatch;

    switch (sortOption) {
      case "recent": {
        const cmp = recentCmp(a, b);
        if (cmp !== 0) return cmp;
        break;
      }
      case "most_me_too": {
        const cmp = meTooCmp(a, b);
        if (cmp !== 0) return cmp;
        const r = recentCmp(a, b);
        if (r !== 0) return r;
        break;
      }
      case "answered_first": {
        const cmp = answeredScore(b) - answeredScore(a);
        if (cmp !== 0) return cmp;
        const r = recentCmp(a, b);
        if (r !== 0) return r;
        break;
      }
      case "unresolved_first": {
        const cmp = openScore(b) - openScore(a);
        if (cmp !== 0) return cmp;
        const r = recentCmp(a, b);
        if (r !== 0) return r;
        break;
      }
      default: {
        const aAnswered = answeredScore(a);
        const bAnswered = answeredScore(b);
        if (aAnswered !== bAnswered) return bAnswered - aAnswered;
        const cmp = meTooCmp(a, b);
        if (cmp !== 0) return cmp;
        const r = recentCmp(a, b);
        if (r !== 0) return r;
      }
    }

    return 0;
  });

  const total = sortedAll.length;
  const totalPages = total > 0 ? Math.ceil(total / requestedPageSize) : 0;
  const page = total === 0 ? 1 : Math.min(requestedPage, Math.max(totalPages, 1));
  const sliceStart = (page - 1) * requestedPageSize;
  const questions = sortedAll.slice(sliceStart, sliceStart + requestedPageSize);
  const paginationMeta = {
    page,
    pageSize: requestedPageSize,
    total,
    totalPages,
    hasMore: page < totalPages,
  };

  const questionIds = questions.map((question) => question.id);
  if (questionIds.length === 0) {
    return NextResponse.json({ questions: [], pagination: paginationMeta });
  }

  const [
    { data: answerRows },
    { data: viewerMeTooRows },
    { data: followupRows },
  ] = await Promise.all([
    admin
      .from("material_question_answers")
      .select("id, question_id, author_id, body, is_official, created_at")
      .in("question_id", questionIds)
      .order("created_at", { ascending: true }),
    admin
      .from("material_question_me_toos")
      .select("question_id")
      .eq("user_id", user.id)
      .in("question_id", questionIds),
    admin
      .from("material_question_followups")
      .select("id, question_id, author_id, role, body, created_at")
      .in("question_id", questionIds)
      .order("created_at", { ascending: true }),
  ]);

  const answers = (answerRows ?? []) as MaterialAnswerRow[];
  const followups = (followupRows ?? []) as MaterialFollowupRow[];
  const answerIds = answers.map((answer) => answer.id);
  const [{ data: helpfulRows }, { data: viewerHelpfulRows }, { data: profiles }] =
    await Promise.all([
      answerIds.length > 0
        ? admin
            .from("material_answer_helpful_votes")
            .select("answer_id")
            .in("answer_id", answerIds)
        : Promise.resolve({ data: [] }),
      answerIds.length > 0
        ? admin
            .from("material_answer_helpful_votes")
            .select("answer_id")
            .eq("user_id", user.id)
            .in("answer_id", answerIds)
        : Promise.resolve({ data: [] }),
      admin
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in(
          "id",
          Array.from(
            new Set([
              ...questions.map((q) => q.author_id),
              ...answers.map((a) => a.author_id),
              ...followups.map((f) => f.author_id),
            ])
          )
        ),
    ]);

  const answersByQuestion = new Map<string, MaterialAnswerRow[]>();
  for (const answer of answers) {
    const current = answersByQuestion.get(answer.question_id) ?? [];
    current.push(answer);
    answersByQuestion.set(answer.question_id, current);
  }

  const followupsByQuestion = new Map<string, MaterialFollowupRow[]>();
  for (const followup of followups) {
    const current = followupsByQuestion.get(followup.question_id) ?? [];
    current.push(followup);
    followupsByQuestion.set(followup.question_id, current);
  }

  const helpfulCountByAnswer = new Map<string, number>();
  for (const row of (helpfulRows ?? []) as Array<{ answer_id: string }>) {
    helpfulCountByAnswer.set(
      row.answer_id,
      (helpfulCountByAnswer.get(row.answer_id) ?? 0) + 1
    );
  }

  const viewerMeToo = new Set(
    ((viewerMeTooRows ?? []) as Array<{ question_id: string }>).map((row) => row.question_id)
  );
  const viewerHelpful = new Set(
    ((viewerHelpfulRows ?? []) as Array<{ answer_id: string }>).map((row) => row.answer_id)
  );
  const profilesById = normalizeProfileRows((profiles ?? []) as ProfileRow[]);
  const answerCountByQuestion = countById(answers.map((answer) => ({ id: answer.question_id })));

  const mappedQuestions = questions.map((question) => {
    const questionAnswers = answersByQuestion.get(question.id) ?? [];
    const questionFollowups = followupsByQuestion.get(question.id) ?? [];
    const isQuestionAuthor = question.author_id === user.id;
    const viewerCanSeeRealIdentity = access.canModerate || isQuestionAuthor;
    const author = resolveQuestionAuthor({
      profile: profilesById.get(question.author_id),
      isAnonymousToBuyers: question.is_anonymous_to_buyers,
      viewerCanSeeRealIdentity,
    });

    const status = question.status as MaterialQuestionStatus;
    let followUpRole: "buyer" | "owner" | null = null;
    if (status !== "hidden") {
      if (isQuestionAuthor && status !== "resolved") {
        followUpRole = "buyer";
      } else if (access.canAnswer) {
        followUpRole = "owner";
      }
    }

    return {
      id: question.id,
      targetType: question.target_type as MaterialTargetType,
      resumeId: question.resume_id,
      courseId: question.course_id,
      moduleId: question.module_id,
      anchorPage: question.anchor_page,
      anchorSeconds: question.anchor_seconds,
      title: question.title,
      body: question.body,
      status,
      createdAt: question.created_at,
      author,
      counts: {
        answers: answerCountByQuestion.get(question.id) ?? 0,
        meToo: meTooTotalsByQuestion.get(question.id) ?? 0,
      },
      viewer: {
        canAnswer: access.canAnswer && status !== "hidden",
        canModerate: access.canModerate,
        hasMeToo: viewerMeToo.has(question.id),
        isOwner: isQuestionAuthor,
        canFollowUp: followUpRole !== null,
        followUpRole,
      },
      answers: questionAnswers.map((answer) => {
        const answerAuthor = profilesById.get(answer.author_id);
        return {
          id: answer.id,
          body: answer.body,
          isOfficial: answer.is_official,
          createdAt: answer.created_at,
          helpfulCount: helpfulCountByAnswer.get(answer.id) ?? 0,
          viewerHasHelpful: viewerHelpful.has(answer.id),
          author: {
            id: answer.author_id,
            displayName: profileDisplayName(answerAuthor, "Autor"),
            avatarUrl: answerAuthor?.avatar_url ?? null,
          },
        };
      }),
      followups: questionFollowups.map((followup) => {
        const followupAuthorProfile = profilesById.get(followup.author_id);
        const role = followup.role === "owner" ? "owner" : "buyer";
        const resolvedAuthor =
          role === "buyer"
            ? resolveQuestionAuthor({
                profile: followupAuthorProfile,
                isAnonymousToBuyers: question.is_anonymous_to_buyers,
                viewerCanSeeRealIdentity,
              })
            : {
                id: followup.author_id,
                displayName: profileDisplayName(followupAuthorProfile, "Autor"),
                avatarUrl: followupAuthorProfile?.avatar_url ?? null,
                isAnonymous: false,
              };

        return {
          id: followup.id,
          body: followup.body,
          role,
          createdAt: followup.created_at,
          author: resolvedAuthor,
        };
      }),
    };
  });

  return NextResponse.json({ questions: mappedQuestions, pagination: paginationMeta });
}

export async function POST(request: NextRequest) {
  const supabase = (await createClient()) as MaterialQuestionsClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("No autorizado", 401);

  const payload = (await request.json().catch(() => null)) as
    | {
        targetType?: string;
        resumeId?: string;
        courseId?: string;
        moduleId?: string;
        anchorPage?: unknown;
        anchorSeconds?: unknown;
        title?: unknown;
        body?: unknown;
        isAnonymousToBuyers?: unknown;
        resume_id?: string;
        course_id?: string;
      }
    | null;

  if (!payload) return jsonError("Body inválido.", 400);

  const hasResume = Boolean(payload.resumeId ?? payload.resume_id);
  const hasCourse = Boolean(payload.courseId ?? payload.course_id);
  if (hasResume && hasCourse) {
    return jsonError("No envíes resume_id y course_id juntos.", 400);
  }

  const targetType = payload.targetType;
  if (targetType !== "resume" && targetType !== "course") {
    return jsonError("targetType debe ser resume o course.", 400);
  }

  const title = validateText(payload.title, 8, 140, "El título");
  if (title.error) return jsonError(title.error, 400);

  const body = validateText(payload.body, 10, 2000, "El detalle");
  if (body.error) return jsonError(body.error, 400);

  const admin = createAdminClient() as MaterialQuestionsClient;
  const isAnonymousToBuyers = payload.isAnonymousToBuyers === true;

  if (targetType === "resume") {
    if (!isUuid(payload.resumeId)) return jsonError("resumeId inválido.", 400);
    if (payload.courseId || payload.course_id) {
      return jsonError("No envíes courseId para consultas de apuntes.", 400);
    }

    const anchorPage = optionalPositiveInteger(payload.anchorPage);
    if (Number.isNaN(anchorPage)) return jsonError("anchorPage debe ser mayor a 0.", 400);

    const access = await getResumeQuestionAccess(admin, user.id, payload.resumeId);
    if (!access.exists) return jsonError("Apunte no encontrado.", 404);
    if (!access.canAsk) return jsonError("Necesitás una compra completada para preguntar.", 403);

    const questionId = randomUUID();
    const { error } = await supabase
      .from("material_questions")
      .insert({
        id: questionId,
        target_type: "resume",
        resume_id: payload.resumeId,
        author_id: user.id,
        anchor_page: anchorPage,
        title: title.value,
        body: body.value,
        is_anonymous_to_buyers: isAnonymousToBuyers,
      });

    if (error) return jsonError(error.message, 500);

    try {
      await notifyOwnerOfNewMaterialQuestion(admin, questionId);
    } catch (notifyError) {
      console.warn("[material-question] owner notify failed", notifyError);
    }

    return NextResponse.json({ id: questionId }, { status: 201 });
  }

  if (!isUuid(payload.courseId)) return jsonError("courseId inválido.", 400);
  if (payload.resumeId || payload.resume_id) {
    return jsonError("No envíes resumeId para consultas de cursos.", 400);
  }

  const anchorSeconds = optionalNonNegativeInteger(payload.anchorSeconds);
  if (Number.isNaN(anchorSeconds)) {
    return jsonError("anchorSeconds debe ser mayor o igual a 0.", 400);
  }

  if (payload.moduleId && !isUuid(payload.moduleId)) {
    return jsonError("moduleId inválido.", 400);
  }

  const access = await getCourseQuestionAccess(admin, user.id, payload.courseId);
  if (!access.exists) return jsonError("Curso no encontrado.", 404);
  if (!access.canAsk) return jsonError("Necesitás una inscripción completada para preguntar.", 403);

  if (payload.moduleId) {
    const moduleBelongs = await validateCourseModuleBelongsToCourse(
      admin,
      payload.courseId,
      payload.moduleId
    );
    if (!moduleBelongs) return jsonError("El módulo no pertenece al curso.", 400);
  }

  const questionId = randomUUID();
  const { error } = await supabase
    .from("material_questions")
    .insert({
      id: questionId,
      target_type: "course",
      course_id: payload.courseId,
      module_id: payload.moduleId ?? null,
      author_id: user.id,
      anchor_seconds: anchorSeconds,
      title: title.value,
      body: body.value,
      is_anonymous_to_buyers: isAnonymousToBuyers,
    });

  if (error) return jsonError(error.message, 500);

  try {
    await notifyOwnerOfNewMaterialQuestion(admin, questionId);
  } catch (notifyError) {
    console.warn("[material-question] owner notify failed", notifyError);
  }

  return NextResponse.json({ id: questionId }, { status: 201 });
}
