"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  RefreshCw,
  Search,
} from "lucide-react";
import { MessageReplyForm } from "@/components/messages/message-reply-form";
import type {
  Profile,
  Subject,
  TutorBooking,
  TutorMessage,
} from "@/lib/database.types";

type VisibleBookingStatus = "confirmed" | "completed" | "cancelled";

type ProfilePreview = Pick<
  Profile,
  "id" | "display_name" | "avatar_url" | "university" | "career"
>;

interface MessagesWorkspaceProps {
  userId: string;
  bookings: TutorBooking[];
  profiles: ProfilePreview[];
  subjects: Subject[];
  messages: TutorMessage[];
  selectedBookingId: string;
}

const STATUS_LABELS: Record<VisibleBookingStatus, string> = {
  confirmed: "Confirmada",
  completed: "Finalizada",
  cancelled: "Cancelada",
};

const STATUS_STYLES: Record<VisibleBookingStatus, string> = {
  confirmed:
    "bg-[#E1F3FE] text-[#1F6C9F] ring-[#B9DFF5] dark:bg-sky-300/[0.12] dark:text-sky-100 dark:ring-sky-300/20",
  completed:
    "bg-[#EDF3EC] text-[#346538] ring-[#D2E3D0] dark:bg-accent-300/[0.12] dark:text-accent-100 dark:ring-accent-300/20",
  cancelled:
    "bg-[#FDEBEC] text-[#9F2F2D] ring-[#F5C9CA] dark:bg-red-300/[0.12] dark:text-red-100 dark:ring-red-300/20",
};

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatRate(value: number | null) {
  if (!value) return null;
  return `${moneyFormatter.format(value)} / hora`;
}

function isVisibleStatus(status: string): status is VisibleBookingStatus {
  return status === "confirmed" || status === "completed" || status === "cancelled";
}

export function MessagesWorkspace({
  userId,
  bookings,
  profiles,
  subjects,
  messages,
  selectedBookingId,
}: MessagesWorkspaceProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const profilesById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );
  const subjectsById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects]
  );
  const messagesByBooking = useMemo(() => {
    const grouped = new Map<string, TutorMessage[]>();
    for (const message of messages) {
      const current = grouped.get(message.booking_id) ?? [];
      current.push(message);
      grouped.set(message.booking_id, current);
    }
    return grouped;
  }, [messages]);

  const unreadByBooking = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const message of messages) {
      if (message.sender_id === userId || message.read_at) continue;
      grouped.set(message.booking_id, (grouped.get(message.booking_id) ?? 0) + 1);
    }
    return grouped;
  }, [messages, userId]);

  const selectedBooking =
    bookings.find((booking) => booking.id === selectedBookingId) ?? bookings[0];
  const selectedMessages = messagesByBooking.get(selectedBooking.id) ?? [];
  const otherUserId =
    selectedBooking.tutor_id === userId
      ? selectedBooking.student_id
      : selectedBooking.tutor_id;
  const otherUser = profilesById.get(otherUserId);
  const selectedSubject = selectedBooking.subject_id
    ? subjectsById.get(selectedBooking.subject_id)
    : null;
  const selectedRate = formatRate(
    selectedBooking.hourly_rate_ars ? Number(selectedBooking.hourly_rate_ars) : null
  );
  const selectedStatus = isVisibleStatus(selectedBooking.status)
    ? selectedBooking.status
    : null;

  const filteredBookings = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return bookings;

    return bookings.filter((booking) => {
      const participantId =
        booking.tutor_id === userId ? booking.student_id : booking.tutor_id;
      const participant = profilesById.get(participantId);
      const subject = booking.subject_id ? subjectsById.get(booking.subject_id) : null;
      const lastMessage = messagesByBooking.get(booking.id)?.at(-1);
      const statusLabel = isVisibleStatus(booking.status)
        ? STATUS_LABELS[booking.status]
        : "";
      const searchable = [
        participant?.display_name,
        subject?.name,
        statusLabel,
        lastMessage?.body,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalized);
    });
  }, [bookings, messagesByBooking, profilesById, query, subjectsById, userId]);

  function refresh() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 450);
  }

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") refresh();
    }

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-[680px] overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-[0_18px_46px_rgba(38,56,51,0.06)] dark:border-white/10 dark:bg-[#0f1e1a] dark:shadow-black/25 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-b border-gray-200 bg-[rgba(var(--surface-warm-rgb),0.55)] dark:border-white/10 dark:bg-white/[0.02] lg:border-b-0 lg:border-r">
        <div className="space-y-3 border-b border-gray-200 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-foreground">Conversaciones</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Solo reservas confirmadas o con historial
              </p>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-gray-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/10"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Actualizar
            </button>
          </div>

          <label className="relative block">
            <span className="sr-only">Buscar conversaciones</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por alumno, profesor o materia"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-gray-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-200/40 dark:border-white/15 dark:bg-[#071713] dark:placeholder:text-sand-300/45 dark:focus:border-accent-300 dark:focus:ring-accent-300/15"
            />
          </label>
        </div>

        <nav aria-label="Conversaciones" className="min-h-0 flex-1 overflow-y-auto p-2">
          {filteredBookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 px-4 py-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm font-bold text-foreground">
                No encontramos conversaciones con ese criterio.
              </p>
            </div>
          ) : (
            filteredBookings.map((booking) => {
              const participantId =
                booking.tutor_id === userId ? booking.student_id : booking.tutor_id;
              const participant = profilesById.get(participantId);
              const subject = booking.subject_id ? subjectsById.get(booking.subject_id) : null;
              const lastMessage = messagesByBooking.get(booking.id)?.at(-1);
              const active = booking.id === selectedBooking.id;
              const unread = unreadByBooking.get(booking.id) ?? 0;
              const status = isVisibleStatus(booking.status) ? booking.status : null;

              return (
                <Link
                  key={booking.id}
                  href={`/mensajes?booking=${booking.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`group block rounded-2xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 ${
                    active
                      ? "border-accent-200 bg-white shadow-[0_8px_24px_rgba(38,56,51,0.06)] dark:border-accent-300/30 dark:bg-accent-300/10"
                      : "border-transparent hover:border-gray-200 hover:bg-white/70 dark:hover:border-white/10 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-accent-100 text-accent-700 ring-1 ring-black/5 dark:bg-accent-300/15 dark:text-accent-100 dark:ring-white/10">
                      {participant?.avatar_url ? (
                        <Image
                          src={participant.avatar_url}
                          alt={participant.display_name}
                          fill
                          sizes="44px"
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
                        {unread > 0 ? (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent-600 px-1.5 text-[10px] font-bold leading-none text-white dark:bg-accent-300 dark:text-[#071713]">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
                          {subject?.name ?? "Materia a coordinar"}
                        </p>
                        {status && (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${STATUS_STYLES[status]}`}
                          >
                            {STATUS_LABELS[status]}
                          </span>
                        )}
                      </div>
                      {booking.scheduled_at && (
                        <p className="mt-1 text-xs font-medium text-muted-foreground">
                          {formatDate(booking.scheduled_at)}
                        </p>
                      )}
                      <p className="mt-2 truncate text-xs text-gray-500 dark:text-sand-300/70">
                        {lastMessage?.body ?? "Sin mensajes todavía"}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </nav>
      </aside>

      <section className="flex min-h-[620px] flex-col">
        <header className="border-b border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#0f1e1a]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-accent-100 text-accent-700 ring-1 ring-black/5 dark:bg-accent-300/15 dark:text-accent-100 dark:ring-white/10">
                {otherUser?.avatar_url ? (
                  <Image
                    src={otherUser.avatar_url}
                    alt={otherUser.display_name}
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold">
                    {initials(otherUser?.display_name ?? "Usuario")}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">
                  {otherUser?.display_name ?? "Usuario"}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {selectedSubject?.name ?? "Materia a coordinar"}
                  {selectedRate ? ` · ${selectedRate}` : ""}
                </p>
              </div>
            </div>
            {selectedStatus && (
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${STATUS_STYLES[selectedStatus]}`}
              >
                {STATUS_LABELS[selectedStatus]}
              </span>
            )}
          </div>
          {selectedBooking.scheduled_at && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 dark:border-white/10 dark:bg-white/[0.04]">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                <time dateTime={selectedBooking.scheduled_at}>
                  {formatDate(selectedBooking.scheduled_at)}
                </time>
              </span>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto bg-[#f7faf8] p-4 dark:bg-[#0b1714] sm:p-5">
          {selectedMessages.length === 0 ? (
            <div className="flex min-h-[420px] items-center justify-center text-center">
              <div className="max-w-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-accent-700 ring-1 ring-gray-200 dark:bg-white/[0.04] dark:text-accent-100 dark:ring-white/10">
                  <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-4 text-sm font-bold text-foreground">
                  Todavía no hay mensajes
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Escribí el primer mensaje para coordinar la clase.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedMessages.map((message) => {
                const mine = message.sender_id === userId;

                return (
                  <div
                    key={message.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-[0_6px_20px_rgba(38,56,51,0.05)] sm:max-w-[70%] ${
                        mine
                          ? "rounded-br-md bg-accent-600 text-white dark:bg-accent-300 dark:text-[#071713]"
                          : "rounded-bl-md border border-gray-200 bg-white text-foreground dark:border-white/10 dark:bg-white/[0.05]"
                      }`}
                    >
                      <p className="break-words">{message.body}</p>
                      <div
                        className={`mt-1.5 flex items-center gap-1.5 text-[10px] ${
                          mine
                            ? "justify-end text-white/75 dark:text-[#071713]/60"
                            : "text-muted-foreground"
                        }`}
                      >
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        <time dateTime={message.created_at}>
                          {formatDate(message.created_at)}
                        </time>
                        {mine && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <MessageReplyForm bookingId={selectedBooking.id} />
      </section>
    </div>
  );
}
