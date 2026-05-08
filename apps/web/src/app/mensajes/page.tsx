import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MessagesWorkspace } from "@/components/messages/messages-workspace";
import type {
  Profile,
  Subject,
  TutorBooking,
  TutorMessage,
} from "@/lib/database.types";

const VISIBLE_MESSAGE_STATUSES = ["confirmed", "completed", "cancelled"] as const;

export default async function MensajesPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  const { booking: selectedBookingParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/mensajes");

  const { data: rawBookings } = await supabase
    .from("tutor_bookings")
    .select("*")
    .or(`tutor_id.eq.${user.id},student_id.eq.${user.id}`)
    .in("status", [...VISIBLE_MESSAGE_STATUSES])
    .order("updated_at", { ascending: false });

  const bookings = (rawBookings as TutorBooking[] | null) ?? [];

  if (bookings.length === 0) {
    const selectedBookingIsUnavailable = selectedBookingParam
      ? await bookingExistsForUser(supabase, selectedBookingParam, user.id)
      : false;

    return (
      <EmptyMessagesState
        unavailableSelectedBooking={selectedBookingIsUnavailable}
      />
    );
  }

  const selectedBooking =
    bookings.find((booking) => booking.id === selectedBookingParam) ?? bookings[0];
  const selectedBookingIsUnavailable =
    selectedBookingParam && selectedBooking.id !== selectedBookingParam
      ? await bookingExistsForUser(supabase, selectedBookingParam, user.id)
      : false;

  if (selectedBookingIsUnavailable) {
    return <EmptyMessagesState unavailableSelectedBooking />;
  }

  const bookingIds = bookings.map((booking) => booking.id);
  const profileIds = Array.from(
    new Set(bookings.flatMap((booking) => [booking.tutor_id, booking.student_id]))
  );
  const subjectIds = Array.from(
    new Set(bookings.map((booking) => booking.subject_id).filter(Boolean))
  ) as string[];

  const [
    { data: rawProfiles },
    { data: rawSubjects },
    { data: rawMessages },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url, university, career")
      .in("id", profileIds),
    subjectIds.length > 0
      ? supabase.from("subjects").select("*").in("id", subjectIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("tutor_messages")
      .select("*")
      .in("booking_id", bookingIds)
      .order("created_at", { ascending: true }),
  ]);

  const messages = (rawMessages as TutorMessage[] | null) ?? [];
  const selectedMessages = messages.filter(
    (message) => message.booking_id === selectedBooking.id
  );
  const unreadIncomingIds = selectedMessages
    .filter((message) => message.sender_id !== user.id && !message.read_at)
    .map((message) => message.id);

  if (unreadIncomingIds.length > 0) {
    await supabase
      .from("tutor_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIncomingIds);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
      <header className="mb-6 border-b border-gray-200/80 pb-5 dark:border-white/10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-100">
          Tutorías
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground text-balance">
          Mensajes
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Coordiná detalles de tus clases confirmadas. Cada conversación
          corresponde a una reserva.
        </p>
      </header>

      <MessagesWorkspace
        userId={user.id}
        bookings={bookings}
        profiles={
          (rawProfiles as Pick<
            Profile,
            "id" | "display_name" | "avatar_url" | "university" | "career"
          >[] | null) ?? []
        }
        subjects={(rawSubjects as Subject[] | null) ?? []}
        messages={messages}
        selectedBookingId={selectedBooking.id}
      />
    </main>
  );
}

async function bookingExistsForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingId: string,
  userId: string
) {
  const { data } = await supabase
    .from("tutor_bookings")
    .select("id")
    .eq("id", bookingId)
    .or(`tutor_id.eq.${userId},student_id.eq.${userId}`)
    .maybeSingle();

  return Boolean(data);
}

function EmptyMessagesState({
  unavailableSelectedBooking = false,
}: {
  unavailableSelectedBooking?: boolean;
}) {
  return (
    <main className="mx-auto flex min-h-[72vh] w-full max-w-4xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full rounded-[22px] border border-gray-200 bg-white p-8 shadow-[0_18px_46px_rgba(38,56,51,0.06)] dark:border-white/10 dark:bg-[#0f1e1a] dark:shadow-black/25 sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-700 ring-1 ring-accent-100 dark:bg-accent-300/15 dark:text-accent-100 dark:ring-accent-300/20">
          <MessageCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-100">
          Mensajes
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground text-balance">
          {unavailableSelectedBooking
            ? "La conversación todavía no está disponible"
            : "Tus conversaciones van a vivir acá"}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {unavailableSelectedBooking
            ? "La conversación estará disponible cuando la reserva esté confirmada."
            : "Cuando una reserva esté confirmada, vas a poder coordinar los detalles de la clase por mensajes."}
        </p>
        <Link
          href="/explorar?tab=particulares"
          className="mt-7 inline-flex items-center justify-center rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 active:scale-[0.98] dark:bg-accent-300 dark:text-[#071713]"
        >
          Explorar profesores
        </Link>
      </div>
    </main>
  );
}
