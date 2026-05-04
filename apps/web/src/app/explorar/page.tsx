import { createClient } from "@/lib/supabase/server";
import { ExploreTabs, type ExploreTab } from "@/components/explorar/explore-tabs";
import type {
  CourseModule,
  Profile,
  RecordedCourse,
  ResumeWithSeller,
  Subject,
  TutorAvailability,
  TutorSubject,
} from "@/lib/database.types";
import type { RecordedCourseItem } from "@/components/courses/types";
import type {
  TutorListItem,
  TutorProfile,
  TutorSubjectItem,
} from "@/components/tutors/types";

const VALID_TABS = new Set<ExploreTab>(["apuntes", "particulares", "grabadas"]);

function normalizeTab(tab: string | undefined): ExploreTab {
  return tab && VALID_TABS.has(tab as ExploreTab) ? (tab as ExploreTab) : "apuntes";
}

function buildTutorItems({
  tutorSubjects,
  profiles,
  subjects,
  availability,
}: {
  tutorSubjects: TutorSubject[];
  profiles: TutorProfile[];
  subjects: Subject[];
  availability: TutorAvailability[];
}): TutorListItem[] {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
  const availabilityByTutor = new Map<string, TutorAvailability[]>();

  for (const slot of availability) {
    const current = availabilityByTutor.get(slot.tutor_id) ?? [];
    current.push(slot);
    availabilityByTutor.set(slot.tutor_id, current);
  }

  const tutorsById = new Map<string, TutorListItem>();

  for (const tutorSubject of tutorSubjects) {
    const profile = profilesById.get(tutorSubject.tutor_id);
    const subject = subjectsById.get(tutorSubject.subject_id);
    if (!profile || !subject) continue;

    const item = tutorsById.get(profile.id) ?? {
      id: profile.id,
      profile,
      subjects: [],
      availability: availabilityByTutor.get(profile.id) ?? [],
      minHourlyRate: tutorSubject.hourly_rate_ars,
    };

    item.subjects.push({ ...tutorSubject, subject } as TutorSubjectItem);
    item.minHourlyRate = Math.min(item.minHourlyRate, tutorSubject.hourly_rate_ars);
    tutorsById.set(profile.id, item);
  }

  return Array.from(tutorsById.values()).sort((a, b) => {
    const verifiedDiff =
      Number(Boolean(b.profile.tutor_verified_at)) -
      Number(Boolean(a.profile.tutor_verified_at));
    if (verifiedDiff !== 0) return verifiedDiff;

    const ratingDiff =
      Number(b.profile.tutor_rating_avg ?? 0) -
      Number(a.profile.tutor_rating_avg ?? 0);
    if (ratingDiff !== 0) return ratingDiff;

    return a.minHourlyRate - b.minHourlyRate;
  });
}

type RawCourse = RecordedCourse & {
  profiles:
    | Pick<
        Profile,
        "id" | "display_name" | "avatar_url" | "university" | "career"
      >
    | null;
  subjects: Pick<Subject, "id" | "name" | "university" | "career"> | null;
  course_modules:
    | Pick<
        CourseModule,
        | "id"
        | "position"
        | "title"
        | "description"
        | "duration_seconds"
        | "video_storage_key"
      >[]
    | null;
};

function normalizeCourseItems(courses: RawCourse[] | null): RecordedCourseItem[] {
  return (courses ?? []).map((course) => ({
    ...course,
    course_modules: [...(course.course_modules ?? [])].sort(
      (a, b) => a.position - b.position
    ),
  }));
}

export default async function ExplorarPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; career?: string }>;
}) {
  const { tab, career: initialCareer } = await searchParams;
  const activeTab = normalizeTab(tab);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resumesPromise = supabase
    .from("resumes")
    .select(
      "*, profiles!seller_id(display_name, avatar_url, seller_rating_avg, seller_rating_count)"
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const purchasesPromise = user
    ? supabase
        .from("purchases")
        .select("resume_id")
        .eq("buyer_id", user.id)
        .eq("status", "completed")
    : Promise.resolve({ data: null });
  const tutorSubjectsPromise = supabase
    .from("tutor_subjects")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  const coursesPromise = supabase
    .from("recorded_courses")
    .select(
      "*, profiles!author_id(id, display_name, avatar_url, university, career), subjects(id, name, university, career), course_modules(id, position, title, description, duration_seconds, video_storage_key)"
    )
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const [
    { data: resumes },
    { data: purchases },
    { data: tutorSubjectRows },
    { data: rawCourses },
  ] = await Promise.all([
      resumesPromise,
      purchasesPromise,
      tutorSubjectsPromise,
      coursesPromise,
    ]);

  const purchasedIds =
    (purchases as { resume_id: string }[] | null)?.map((purchase) => purchase.resume_id) ??
    [];
  const activeTutorSubjects = (tutorSubjectRows as TutorSubject[] | null) ?? [];
  const courses = normalizeCourseItems((rawCourses as RawCourse[] | null) ?? []);
  const tutorIds = Array.from(
    new Set(activeTutorSubjects.map((subject) => subject.tutor_id))
  );
  const subjectIds = Array.from(
    new Set(activeTutorSubjects.map((subject) => subject.subject_id))
  );

  let tutors: TutorListItem[] = [];

  if (tutorIds.length > 0 && subjectIds.length > 0) {
    const [
      { data: tutorProfiles },
      { data: subjects },
      { data: availability },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, display_name, avatar_url, university, career, bio, tutor_bio, tutor_verified_at, tutor_rating_avg, tutor_rating_count"
        )
        .eq("is_tutor", true)
        .in("id", tutorIds),
      supabase.from("subjects").select("*").in("id", subjectIds),
      supabase
        .from("tutor_availability")
        .select("*")
        .in("tutor_id", tutorIds)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true }),
    ]);

    tutors = buildTutorItems({
      tutorSubjects: activeTutorSubjects,
      profiles: (tutorProfiles as TutorProfile[] | null) ?? [],
      subjects: (subjects as Subject[] | null) ?? [],
      availability: (availability as TutorAvailability[] | null) ?? [],
    });
  }

  return (
    <ExploreTabs
      activeTab={activeTab}
      resumes={(resumes as ResumeWithSeller[]) ?? []}
      tutors={tutors}
      courses={courses}
      purchasedIds={purchasedIds}
      initialCareer={initialCareer}
    />
  );
}
