import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PurchaseWithResume, FolderWithItems } from "@/lib/database.types";
import { LibraryWorkspace, type EnrolledCourseRow } from "./library-workspace";

export default async function MisApuntesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/my-purchases");

  const [{ data: purchases }, { data: folders }, { data: enrollmentsRaw }] = await Promise.all([
    supabase
      .from("purchases")
      .select("*, resumes(title, subject, university, preview_url, profiles!seller_id(display_name)), reviews(id)")
      .eq("buyer_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false }),
    supabase
      .from("folders")
      .select("*, folder_items(resume_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("course_enrollments")
      .select(
        "id, course_id, amount, purchased_at, recorded_courses!inner(id, title, course_type, cover_color, cover_image_url, total_duration_seconds, subjects(university), course_modules(id, position, duration_seconds)), course_progress(module_id, watched_seconds, completed_at, updated_at)"
      )
      .eq("student_id", user.id)
      .eq("status", "completed")
      .order("purchased_at", { ascending: false }),
  ]);

  const list = (purchases as PurchaseWithResume[]) ?? [];
  const folderList = (folders as FolderWithItems[]) ?? [];
  const enrollments = (enrollmentsRaw as unknown as EnrolledCourseRow[] | null) ?? [];

  return (
    <LibraryWorkspace
      purchases={list}
      folders={folderList}
      enrollments={enrollments}
    />
  );
}
