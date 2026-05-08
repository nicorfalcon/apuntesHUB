import Link from "next/link";
import { redirect } from "next/navigation";
import { TeacherProfileWorkspace } from "./teacher-profile-workspace";
import type {
  InitialTutorAvailability,
  InitialTutorSubject,
} from "@/app/sell/tutor-form";
import { createClient } from "@/lib/supabase/server";

export default async function TeacherProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/profile/profesor");

  const [
    { data: profile },
    { data: tutorSubjects },
    { data: tutorAvailability },
    { data: bookings },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, avatar_url, bio, university, career, tutor_bio, is_tutor, tutor_verified_at"
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("tutor_subjects")
      .select(
        "id, hourly_rate_ars, approval_proof_url, subjects(id, name, university, career)"
      )
      .eq("tutor_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("tutor_availability")
      .select("id, day_of_week, start_time, end_time, modality")
      .eq("tutor_id", user.id)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("tutor_bookings")
      .select(
        "id, scheduled_at, duration_minutes, hourly_rate_ars, amount, status, modality, meeting_url, location_details, initial_message, student_id, subjects(name), profiles!student_id(display_name)"
      )
      .eq("tutor_id", user.id)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(30),
  ]);

  const initialSubjects = (tutorSubjects ?? []) as InitialTutorSubject[];
  const initialAvailability = (tutorAvailability ?? []) as InitialTutorAvailability[];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-100">
              Cuenta
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              Perfil de profesor
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Configurá cómo te ven los alumnos, qué materias enseñás y cuándo estás disponible.
            </p>
          </div>
          <Link
            href={`/tutores/${user.id}`}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/10"
          >
            Ver perfil público
          </Link>
        </header>

        <section className="mt-8">
          <TeacherProfileWorkspace
            profile={profile}
            initialSubjects={initialSubjects}
            initialAvailability={initialAvailability}
            bookings={(bookings ?? []) as never}
          />
        </section>
      </div>
    </main>
  );
}
