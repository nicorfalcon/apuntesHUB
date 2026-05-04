import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EnrollmentStatusPoller } from "./enrollment-status-poller";

export default async function CourseCheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ enrollment_id?: string }>;
}) {
  const { enrollment_id } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!enrollment_id) redirect("/explorar?tab=grabadas");

  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id, course_id, status")
    .eq("id", enrollment_id)
    .eq("student_id", user.id)
    .single();

  if (!enrollment) redirect("/explorar?tab=grabadas");

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <EnrollmentStatusPoller
          enrollmentId={enrollment.id}
          courseId={enrollment.course_id}
        />
      </div>
    </div>
  );
}
