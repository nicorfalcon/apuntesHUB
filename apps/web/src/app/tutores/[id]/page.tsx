import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
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
import { BookTutorDialog } from "@/components/tutors/book-tutor-dialog";
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
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                    {profile.display_name}
                  </h1>
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

            <aside className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-700 dark:text-accent-100">
                Reservá una clase
              </p>
              <p className="mt-1 text-3xl font-bold text-foreground">
                {minHourlyRate ? `$${formatArs(minHourlyRate)}` : "A coordinar"}
              </p>
              {minHourlyRate && (
                <p className="text-sm text-muted-foreground">
                  ARS / hora, según materia y duración
                </p>
              )}

              <div className="my-5 border-t border-gray-200 dark:border-white/10" />

              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {summarizeModalities(availability)}
                </p>
                <p className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Horarios reales al reservar
                </p>
              </div>

              <BookTutorDialog
                tutorId={profile.id}
                tutorName={profile.display_name}
                subjects={tutorSubjectItems.map((item) => ({
                  id: item.subject.id,
                  name: item.subject.name,
                  hourlyRate: item.hourly_rate_ars,
                }))}
              />

              <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
                Después del pago vas a poder coordinar los detalles por mensajes.
              </p>
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
