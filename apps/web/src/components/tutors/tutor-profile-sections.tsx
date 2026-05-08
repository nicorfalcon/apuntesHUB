"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { StarRating } from "@/components/ui/star-rating";
import {
  formatArs,
  formatDay,
  formatModality,
  formatTime,
} from "./format";
import type { Profile, TutorAvailability, TutorReview } from "@/lib/database.types";
import type { TutorSubjectItem } from "./types";

type TutorSection = "sobre-mi" | "materias" | "disponibilidad" | "resenas";

interface TutorProfileSectionsProps {
  bio: string | null;
  subjects: TutorSubjectItem[];
  availability: TutorAvailability[];
  reviews: TutorReview[];
  reviewers: Pick<Profile, "id" | "display_name" | "avatar_url">[];
}

const SECTIONS: { id: TutorSection; label: string }[] = [
  { id: "sobre-mi", label: "Sobre mí" },
  { id: "materias", label: "Materias" },
  { id: "disponibilidad", label: "Disponibilidad general" },
  { id: "resenas", label: "Reseñas" },
];

function normalizeSection(hash: string): TutorSection {
  const value = hash.replace("#", "");
  return SECTIONS.some((section) => section.id === value)
    ? (value as TutorSection)
    : "sobre-mi";
}

function summarizeAvailabilityDetails(availability: TutorAvailability[]) {
  if (availability.length === 0) {
    return {
      days: "A coordinar",
      timeRange: "A coordinar",
      modalities: "A coordinar",
    };
  }

  const days = Array.from(
    new Set(availability.map((slot) => slot.day_of_week))
  ).sort((a, b) => a - b);
  const modalities = Array.from(
    new Set(availability.map((slot) => slot.modality))
  );
  const starts = availability.map((slot) => slot.start_time).sort();
  const ends = availability.map((slot) => slot.end_time).sort();

  return {
    days: days.map((day) => formatDay(day, true)).join(" · "),
    timeRange: `${formatTime(starts[0])} a ${formatTime(ends[ends.length - 1])}`,
    modalities: modalities.map(formatModality).join(" · "),
  };
}

export function TutorProfileSections({
  bio,
  subjects,
  availability,
  reviews,
  reviewers,
}: TutorProfileSectionsProps) {
  const [activeSection, setActiveSection] = useState<TutorSection>("sobre-mi");
  const reviewersById = useMemo(
    () => new Map(reviewers.map((reviewer) => [reviewer.id, reviewer])),
    [reviewers]
  );
  const availabilitySummary = useMemo(
    () => summarizeAvailabilityDetails(availability),
    [availability]
  );

  useEffect(() => {
    function syncFromHash() {
      setActiveSection(normalizeSection(window.location.hash));
    }

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function selectSection(section: TutorSection) {
    setActiveSection(section);
    window.history.replaceState(null, "", `#${section}`);
  }

  return (
    <>
      <nav
        aria-label="Secciones del perfil del profesor"
        className="mt-6 flex gap-2 overflow-x-auto rounded-full border border-gray-200 bg-[var(--surface-warm)] p-1 dark:border-white/10"
      >
        {SECTIONS.map((section) => {
          const active = activeSection === section.id;

          return (
            <button
              key={section.id}
              type="button"
              aria-pressed={active}
              onClick={() => selectSection(section.id)}
              className={`min-w-max rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-accent-600 text-white dark:bg-accent-300 dark:text-[#071713]"
                  : "text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white"
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-6">
        {activeSection === "sobre-mi" && (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#0f1e1a]">
            <h2 className="text-xl font-bold text-foreground">Sobre mí</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {bio ?? "Este profesor todavía no cargó una biografía pública."}
            </p>
          </section>
        )}

        {activeSection === "materias" && (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#0f1e1a]">
            <h2 className="text-xl font-bold text-foreground">Materias</h2>
            {subjects.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Todavía no hay materias publicadas.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-gray-100 dark:divide-white/10">
                {subjects.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {item.subject.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {[item.subject.university, item.subject.career]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-bold text-foreground">
                        ${formatArs(item.hourly_rate_ars)}
                      </p>
                      <p className="text-xs text-muted-foreground">ARS / hora</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeSection === "disponibilidad" && (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#0f1e1a]">
            <h2 className="text-xl font-bold text-foreground">
              Disponibilidad general
            </h2>
            {availability.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Los horarios se coordinan por mensaje.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      Días
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {availabilitySummary.days}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Franja
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {availabilitySummary.timeRange}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      Modalidades
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {availabilitySummary.modalities}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-accent-200 bg-accent-50/60 p-4 dark:border-accent-300/20 dark:bg-accent-300/10">
                  <p className="text-sm font-semibold text-foreground">
                    {availability.length} franja{availability.length === 1 ? "" : "s"} semanal{availability.length === 1 ? "" : "es"} publicada{availability.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {activeSection === "resenas" && (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#0f1e1a]">
            <h2 className="text-xl font-bold text-foreground">Reseñas</h2>
            {reviews.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Todavía no hay reseñas de clases particulares.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {reviews.map((review) => {
                  const reviewer = reviewersById.get(review.reviewer_id);

                  return (
                    <article
                      key={review.id}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {reviewer?.display_name ?? "Estudiante"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString("es-AR")}
                          </p>
                        </div>
                        <StarRating rating={review.rating} />
                      </div>
                      {review.comment && (
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          {review.comment}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
