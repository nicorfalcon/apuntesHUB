import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MessageReplyForm } from "@/components/messages/message-reply-form";
import type {
  Profile,
  Subject,
  TutorBooking,
  TutorMessage,
} from "@/lib/database.types";

type BookingStatus = "requested" | "confirmed" | "completed" | "cancelled";

const STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "Solicitada",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
    .order("updated_at", { ascending: false });

  const bookings = (rawBookings as TutorBooking[] | null) ?? [];

  if (bookings.length === 0) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-700 dark:bg-accent-300/15 dark:text-accent-100">
          <MessageCircle className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-foreground">Mensajes</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Todavía no tenés solicitudes de clases particulares. Cuando contactes
          a un profesor, el hilo va a aparecer acá.
        </p>
        <Link
          href="/explorar?tab=particulares"
          className="mt-6 rounded-full bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713]"
        >
          Buscar profesores
        </Link>
      </main>
    );
  }

  const selectedBooking =
    bookings.find((booking) => booking.id === selectedBookingParam) ?? bookings[0];
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

  const profiles = new Map(
    ((rawProfiles as Pick<
      Profile,
      "id" | "display_name" | "avatar_url" | "university" | "career"
    >[] | null) ?? []).map((profile) => [profile.id, profile])
  );
  const subjects = new Map(
    ((rawSubjects as Subject[] | null) ?? []).map((subject) => [subject.id, subject])
  );
  const messages = (rawMessages as TutorMessage[] | null) ?? [];
  const messagesByBooking = new Map<string, TutorMessage[]>();

  for (const message of messages) {
    const current = messagesByBooking.get(message.booking_id) ?? [];
    current.push(message);
    messagesByBooking.set(message.booking_id, current);
  }

  const selectedMessages = messagesByBooking.get(selectedBooking.id) ?? [];
  const otherUserId =
    selectedBooking.tutor_id === user.id
      ? selectedBooking.student_id
      : selectedBooking.tutor_id;
  const otherUser = profiles.get(otherUserId);
  const selectedSubject = selectedBooking.subject_id
    ? subjects.get(selectedBooking.subject_id)
    : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Mensajes</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Solicitudes y conversaciones de clases particulares.
        </p>
      </div>

      <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0f1e1a] lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="border-b border-gray-200 dark:border-white/10 lg:border-b-0 lg:border-r">
          <div className="border-b border-gray-200 p-4 dark:border-white/10">
            <p className="text-sm font-semibold text-foreground">
              Conversaciones
            </p>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {bookings.map((booking) => {
              const participantId =
                booking.tutor_id === user.id ? booking.student_id : booking.tutor_id;
              const participant = profiles.get(participantId);
              const subject = booking.subject_id
                ? subjects.get(booking.subject_id)
                : null;
              const lastMessage = messagesByBooking.get(booking.id)?.at(-1);
              const active = booking.id === selectedBooking.id;

              return (
                <Link
                  key={booking.id}
                  href={`/mensajes?booking=${booking.id}`}
                  className={`block border-b border-gray-100 p-4 transition-colors dark:border-white/10 ${
                    active
                      ? "bg-accent-50 dark:bg-accent-300/15"
                      : "hover:bg-gray-50 dark:hover:bg-white/5"
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-accent-100 text-accent-700 dark:bg-accent-300/15 dark:text-accent-100">
                      {participant?.avatar_url ? (
                        <Image
                          src={participant.avatar_url}
                          alt={participant.display_name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-bold">
                          {initials(participant?.display_name ?? "Usuario")}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {participant?.display_name ?? "Usuario"}
                        </p>
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-white/10 dark:text-sand-200">
                          {STATUS_LABELS[booking.status as BookingStatus] ?? booking.status}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {subject?.name ?? "Materia a coordinar"}
                      </p>
                      {lastMessage && (
                        <p className="mt-1 truncate text-xs text-gray-400">
                          {lastMessage.body}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-[620px] flex-col">
          <header className="border-b border-gray-200 p-4 dark:border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {otherUser?.display_name ?? "Usuario"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedSubject?.name ?? "Materia a coordinar"}
                  {selectedBooking.hourly_rate_ars
                    ? ` · $${Number(selectedBooking.hourly_rate_ars).toLocaleString("es-AR")} ARS / hora`
                    : ""}
                </p>
              </div>
              <span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700 dark:bg-accent-300/15 dark:text-accent-100">
                {STATUS_LABELS[selectedBooking.status as BookingStatus] ??
                  selectedBooking.status}
              </span>
            </div>
            {selectedBooking.scheduled_at && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(selectedBooking.scheduled_at)}
              </p>
            )}
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50/70 p-4 dark:bg-[#0b1714]">
            {selectedMessages.map((message) => {
              const mine = message.sender_id === user.id;

              return (
                <div
                  key={message.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                      mine
                        ? "bg-accent-600 text-white dark:bg-accent-300 dark:text-[#071713]"
                        : "border border-gray-200 bg-white text-foreground dark:border-white/10 dark:bg-white/5"
                    }`}
                  >
                    <p>{message.body}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        mine ? "text-white/70 dark:text-[#071713]/60" : "text-muted-foreground"
                      }`}
                    >
                      {formatDate(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <MessageReplyForm bookingId={selectedBooking.id} />
        </section>
      </div>
    </main>
  );
}

