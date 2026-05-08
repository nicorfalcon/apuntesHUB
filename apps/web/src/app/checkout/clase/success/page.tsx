import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookingStatusPoller } from "./booking-status-poller";

export default async function TutoringCheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string }>;
}) {
  const { booking_id } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!booking_id) redirect("/explorar?tab=particulares");

  const { data: booking } = await supabase
    .from("tutor_bookings")
    .select(`
      id, 
      status, 
      scheduled_at, 
      duration_minutes, 
      modality, 
      amount,
      meeting_url,
      location_details,
      initial_message,
      tutor:profiles!tutor_id(display_name),
      subjects(name)
    `)
    .eq("id", booking_id)
    .or(`student_id.eq.${user.id},tutor_id.eq.${user.id}`)
    .single();

  if (!booking) redirect("/explorar?tab=particulares");

  const tutor = booking.tutor as unknown as { display_name: string } | { display_name: string }[] | null;
  const tutorName = Array.isArray(tutor) ? tutor[0]?.display_name : tutor?.display_name ?? "Profesor";

  const subject = booking.subjects as unknown as { name: string } | { name: string }[] | null;
  const subjectName = Array.isArray(subject) ? subject[0]?.name : subject?.name ?? "Materia";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <BookingStatusPoller 
          bookingId={booking.id}
          initialStatus={booking.status}
          tutorName={tutorName}
          subjectName={subjectName}
          scheduledAt={booking.scheduled_at}
          durationMinutes={booking.duration_minutes ?? 60}
          modality={booking.modality ?? "online"}
          amount={booking.amount}
          meetingUrl={booking.meeting_url}
          locationDetails={booking.location_details}
          initialMessage={booking.initial_message}
        />
      </div>
    </div>
  );
}
