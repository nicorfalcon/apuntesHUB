import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  GraduationCap,
  MapPin,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/ui/star-rating";
import {
  formatArs,
  summarizeModalities,
} from "@/components/tutors/format";
import { ContactTutorDialog } from "@/components/tutors/contact-tutor-dialog";
import { TutorProfileSections } from "@/components/tutors/tutor-profile-sections";
import type {
  Profile,
  Subject,
  TutorAvailability,
  TutorReview,
  TutorSubject,
} from "@/lib/database.types";
import type { TutorSubjectItem } from "@/components/tutors/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function buildTutorSubjects(
  tutorSubjects: TutorSubject[],
  subjects: Subject[]
): TutorSubjectItem[] {
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));

  return tutorSubjects
    .map((tutorSubject) => {
      const subject = subjectsById.get(tutorSubject.subject_id);
      if (!subject) return null;
      return { ...tutorSubject, subject } as TutorSubjectItem;
    })
    .filter((item): item is TutorSubjectItem => Boolean(item));
}

export default async function TutorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: rawProfile },
    { data: rawTutorSubjects },
    { data: rawAvailability },
    { data: rawReviews },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase
      .from("tutor_subjects")
      .select("*")
      .eq("tutor_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("tutor_availability")
      .select("*")
      .eq("tutor_id", id)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("tutor_reviews")
      .select("*")
      .eq("tutor_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (!rawProfile) notFound();

  const profile = rawProfile as Profile;
  const tutorSubjects = (rawTutorSubjects as TutorSubject[] | null) ?? [];
  const availability = (rawAvailability as TutorAvailability[] | null) ?? [];
  const reviews = (rawReviews as TutorReview[] | null) ?? [];

  if (!profile.is_tutor && tutorSubjects.length === 0) notFound();

  const subjectIds = Array.from(
    new Set(tutorSubjects.map((subject) => subject.subject_id))
  );
  const reviewerIds = Array.from(new Set(reviews.map((review) => review.reviewer_id)));

  const [{ data: rawSubjects }, { data: rawReviewers }] = await Promise.all([
    subjectIds.length > 0
      ? supabase.from("subjects").select("*").in("id", subjectIds)
      : Promise.resolve({ data: [] }),
    reviewerIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", reviewerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const subjects = (rawSubjects as Subject[] | null) ?? [];
  const tutorSubjectItems = buildTutorSubjects(tutorSubjects, subjects);
  const reviewers =
    (rawReviewers as Pick<Profile, "id" | "display_name" | "avatar_url">[] | null) ??
    [];
  const minHourlyRate =
    tutorSubjectItems.length > 0
      ? Math.min(...tutorSubjectItems.map((item) => item.hourly_rate_ars))
      : null;
  const verified = Boolean(profile.tutor_verified_at);
  const bio = profile.tutor_bio || profile.bio;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
        <Link
          href="/explorar?tab=particulares"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a profesores
        </Link>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#0f1e1a] md:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-3xl bg-accent-100 text-accent-700 ring-1 ring-accent-200 dark:bg-accent-300/15 dark:text-accent-100 dark:ring-accent-300/20">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold">
                    {initials(profile.display_name)}
                  </div>
                )}
                {verified && (
                  <span className="absolute bottom-1.5 right-1.5 rounded-full bg-accent-600 p-1.5 text-white ring-2 ring-white dark:bg-accent-300 dark:text-[#071713] dark:ring-[#0f1e1a]">
                    <BadgeCheck className="h-4 w-4" />
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                    {profile.display_name}
                  </h1>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      verified
                        ? "bg-accent-50 text-accent-700 dark:bg-accent-300/15 dark:text-accent-100"
                        : "bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-gray-300"
                    }`}
                  >
                    {verified ? "Tutor verificado" : "Verificación pendiente"}
                  </span>
                </div>

                {(profile.university || profile.career) && (
                  <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <GraduationCap className="h-4 w-4" />
                    {[profile.university, profile.career].filter(Boolean).join(" · ")}
                  </p>
                )}

                <div className="mt-4">
                  <StarRating
                    rating={profile.tutor_rating_avg ?? 0}
                    count={profile.tutor_rating_count ?? 0}
                    size="md"
                  />
                </div>
              </div>
            </div>

            <aside className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Tarifa
              </p>
              <p className="mt-1 text-3xl font-bold text-foreground">
                {minHourlyRate ? `$${formatArs(minHourlyRate)}` : "A coordinar"}
              </p>
              {minHourlyRate && (
                <p className="text-sm text-muted-foreground">ARS / hora</p>
              )}

              <div className="my-5 border-t border-gray-200 dark:border-white/10" />

              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {summarizeModalities(availability)}
                </p>
                <p className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {availability.length > 0
                    ? `${availability.length} horario${availability.length === 1 ? "" : "s"} publicado${availability.length === 1 ? "" : "s"}`
                    : "Horarios a coordinar"}
                </p>
              </div>

              <ContactTutorDialog
                tutorId={profile.id}
                tutorName={profile.display_name}
                subjects={tutorSubjectItems.map((item) => ({
                  id: item.subject.id,
                  name: item.subject.name,
                  hourlyRate: item.hourly_rate_ars,
                }))}
              />
            </aside>
          </div>
        </section>

        <TutorProfileSections
          bio={bio}
          subjects={tutorSubjectItems}
          availability={availability}
          reviews={reviews}
          reviewers={reviewers}
        />
      </div>
    </main>
  );
}
