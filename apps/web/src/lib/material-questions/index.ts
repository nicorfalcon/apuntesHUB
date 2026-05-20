import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type MaterialTargetType = "resume" | "course";
export type MaterialQuestionStatus = "open" | "answered" | "resolved" | "hidden";

export type MaterialQuestionsClient = SupabaseClient<Database>;

export interface MaterialAccess {
  exists: boolean;
  canView: boolean;
  canAsk: boolean;
  canAnswer: boolean;
  canModerate: boolean;
  canReact: boolean;
  isOwner: boolean;
}

export interface MaterialQuestionAccess extends MaterialAccess {
  question: {
    id: string;
    target_type: MaterialTargetType;
    resume_id: string | null;
    course_id: string | null;
    module_id: string | null;
    author_id: string;
    status: MaterialQuestionStatus;
  } | null;
  isQuestionAuthor: boolean;
}

export interface QuestionAuthorProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface ResolvedQuestionAuthor {
  id: string | null;
  displayName: string;
  avatarUrl: string | null;
  isAnonymous: boolean;
}

const emptyAccess: MaterialAccess = {
  exists: false,
  canView: false,
  canAsk: false,
  canAnswer: false,
  canModerate: false,
  canReact: false,
  isOwner: false,
};

function profileName(
  profile: Pick<QuestionAuthorProfile, "display_name"> | null | undefined,
  fallback: string
) {
  const name = profile?.display_name?.trim();
  return name && name.length > 0 ? name : fallback;
}

export function resolveQuestionAuthor({
  profile,
  isAnonymousToBuyers,
  viewerCanSeeRealIdentity,
}: {
  profile: QuestionAuthorProfile | null | undefined;
  isAnonymousToBuyers: boolean;
  viewerCanSeeRealIdentity: boolean;
}): ResolvedQuestionAuthor {
  if (isAnonymousToBuyers && !viewerCanSeeRealIdentity) {
    return {
      id: null,
      displayName: "Estudiante anónimo",
      avatarUrl: null,
      isAnonymous: true,
    };
  }

  return {
    id: profile?.id ?? null,
    displayName: profileName(profile, "Estudiante"),
    avatarUrl: profile?.avatar_url ?? null,
    isAnonymous: false,
  };
}

export async function getResumeQuestionAccess(
  supabase: MaterialQuestionsClient,
  userId: string,
  resumeId: string
): Promise<MaterialAccess> {
  const [{ data: resume }, { data: purchase }] = await Promise.all([
    supabase
      .from("resumes")
      .select("id, seller_id")
      .eq("id", resumeId)
      .maybeSingle(),
    supabase
      .from("purchases")
      .select("id")
      .eq("resume_id", resumeId)
      .eq("buyer_id", userId)
      .eq("status", "completed")
      .maybeSingle(),
  ]);

  if (!resume) return emptyAccess;

  const isOwner = resume.seller_id === userId;
  const canAsk = Boolean(purchase);

  return {
    exists: true,
    isOwner,
    canAsk,
    canView: isOwner || canAsk,
    canAnswer: isOwner,
    canModerate: isOwner,
    canReact: canAsk,
  };
}

export async function getCourseQuestionAccess(
  supabase: MaterialQuestionsClient,
  userId: string,
  courseId: string
): Promise<MaterialAccess> {
  const [{ data: course }, { data: enrollment }] = await Promise.all([
    supabase
      .from("recorded_courses")
      .select("id, author_id")
      .eq("id", courseId)
      .maybeSingle(),
    supabase
      .from("course_enrollments")
      .select("id")
      .eq("course_id", courseId)
      .eq("student_id", userId)
      .eq("status", "completed")
      .maybeSingle(),
  ]);

  if (!course) return emptyAccess;

  const isOwner = course.author_id === userId;
  const canAsk = Boolean(enrollment);

  return {
    exists: true,
    isOwner,
    canAsk,
    canView: isOwner || canAsk,
    canAnswer: isOwner,
    canModerate: isOwner,
    canReact: canAsk,
  };
}

export async function canViewResumeQuestions(
  supabase: MaterialQuestionsClient,
  userId: string,
  resumeId: string
) {
  return (await getResumeQuestionAccess(supabase, userId, resumeId)).canView;
}

export async function canAskResumeQuestion(
  supabase: MaterialQuestionsClient,
  userId: string,
  resumeId: string
) {
  return (await getResumeQuestionAccess(supabase, userId, resumeId)).canAsk;
}

export async function canAnswerResumeQuestion(
  supabase: MaterialQuestionsClient,
  userId: string,
  resumeId: string
) {
  return (await getResumeQuestionAccess(supabase, userId, resumeId)).canAnswer;
}

export async function canViewCourseQuestions(
  supabase: MaterialQuestionsClient,
  userId: string,
  courseId: string
) {
  return (await getCourseQuestionAccess(supabase, userId, courseId)).canView;
}

export async function canAskCourseQuestion(
  supabase: MaterialQuestionsClient,
  userId: string,
  courseId: string
) {
  return (await getCourseQuestionAccess(supabase, userId, courseId)).canAsk;
}

export async function canAnswerCourseQuestion(
  supabase: MaterialQuestionsClient,
  userId: string,
  courseId: string
) {
  return (await getCourseQuestionAccess(supabase, userId, courseId)).canAnswer;
}

export async function validateCourseModuleBelongsToCourse(
  supabase: MaterialQuestionsClient,
  courseId: string,
  moduleId: string
) {
  const { data } = await supabase
    .from("course_modules")
    .select("id")
    .eq("id", moduleId)
    .eq("course_id", courseId)
    .maybeSingle();

  return Boolean(data);
}

export async function getQuestionAccess(
  supabase: MaterialQuestionsClient,
  userId: string,
  questionId: string
): Promise<MaterialQuestionAccess> {
  const { data: question } = await supabase
    .from("material_questions")
    .select("id, target_type, resume_id, course_id, module_id, author_id, status")
    .eq("id", questionId)
    .maybeSingle();

  if (!question) {
    return { ...emptyAccess, question: null, isQuestionAuthor: false };
  }

  const normalizedQuestion = {
    ...question,
    target_type: question.target_type as MaterialTargetType,
    status: question.status as MaterialQuestionStatus,
  };

  const materialAccess =
    normalizedQuestion.target_type === "resume" && normalizedQuestion.resume_id
      ? await getResumeQuestionAccess(supabase, userId, normalizedQuestion.resume_id)
      : normalizedQuestion.target_type === "course" && normalizedQuestion.course_id
        ? await getCourseQuestionAccess(supabase, userId, normalizedQuestion.course_id)
        : emptyAccess;

  const isQuestionAuthor = normalizedQuestion.author_id === userId;
  const canViewHidden = materialAccess.canModerate || isQuestionAuthor;
  const canView =
    normalizedQuestion.status === "hidden"
      ? canViewHidden
      : materialAccess.canView || isQuestionAuthor;

  return {
    ...materialAccess,
    question: normalizedQuestion,
    isQuestionAuthor,
    canView,
    canAnswer: materialAccess.canAnswer && normalizedQuestion.status !== "hidden",
    canReact: materialAccess.canReact && normalizedQuestion.status !== "hidden",
  };
}
