import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellNavbar } from "@/components/layout/sell-navbar";
import { SellNewShell } from "./sell-new-shell";
import type { Profile } from "@/lib/database.types";

export default async function NuevoApuntePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/sell/new");

  const [{ data: profile }, { data: tutorSubjects }, { data: tutorAvailability }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url, bio, university, career, tutor_bio, is_tutor")
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
    ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <Suspense fallback={<div className="h-14 border-b border-gray-200 bg-white dark:border-white/10 dark:bg-[#101816]" />}>
        <SellNavbar />
      </Suspense>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <SellNewShell
          userId={user.id}
          profile={(profile as Partial<Profile> | null) ?? null}
          initialTutorSubjects={tutorSubjects ?? []}
          initialAvailability={tutorAvailability ?? []}
        />
      </div>
    </div>
  );
}
