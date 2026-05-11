import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { StudentBookingsList } from "@/components/tutors/student-bookings-list";
import { createClient } from "@/lib/supabase/server";

export default async function ClassesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/clases");

  const { data: bookings } = await supabase
    .from("tutor_bookings")
    .select(
      `
        id,
        scheduled_at,
        duration_minutes,
        amount,
        status,
        modality,
        meeting_url,
        location_details,
        initial_message,
        subjects(name),
        tutor:profiles!tutor_id(display_name)
      `
    )
    .eq("student_id", user.id)
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-100">
              Clases
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              Mis clases
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Consultá tus próximas clases, datos de acceso y reservas anteriores.
            </p>
          </div>
          <Link
            href="/explorar?tab=particulares"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
          >
            Explorar profesores
          </Link>
        </header>

        <section className="mt-8">
          <StudentBookingsList bookings={(bookings ?? []) as never} />
        </section>

        <aside className="mt-8 rounded-2xl border border-accent-200 bg-accent-50/70 p-5 dark:border-accent-300/20 dark:bg-accent-300/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-accent-700 ring-1 ring-accent-200 dark:bg-[#071713] dark:text-accent-100 dark:ring-accent-300/20">
                <GraduationCap className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  ¿Querés ser profe y dar tus propias clases?
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Configurá tu perfil de profesor y empezá a recibir reservas.
                </p>
              </div>
            </div>
            <Link
              href="/profile/profesor"
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-accent-300 bg-white px-4 py-2.5 text-sm font-bold text-accent-700 transition-colors hover:bg-accent-50 dark:border-accent-300/25 dark:bg-[#071713] dark:text-accent-100 dark:hover:bg-accent-300/10"
            >
              Configurar perfil de profesor
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
