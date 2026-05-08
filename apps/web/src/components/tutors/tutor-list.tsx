import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  GraduationCap,
  MapPin,
} from "lucide-react";
import { StarRating } from "@/components/ui/star-rating";
import {
  formatArs,
  summarizeAvailability,
  summarizeModalities,
} from "./format";
import type { TutorListItem } from "./types";

interface TutorListProps {
  tutors: TutorListItem[];
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TutorList({ tutors }: TutorListProps) {
  return (
    <div className="space-y-3">
      {tutors.map((tutor) => {
        const subjectNames = tutor.subjects
          .map((item) => item.subject.name)
          .slice(0, 3);
        const extraSubjects = Math.max(tutor.subjects.length - subjectNames.length, 0);
        const profile = tutor.profile;

        return (
          <article
            key={tutor.id}
            className="group rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-accent-300 dark:border-white/10 dark:bg-[#0f1e1a] dark:hover:border-accent-300/35 sm:p-5"
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
              <div className="flex min-w-0 gap-4">
                <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-accent-100 text-accent-700 ring-1 ring-accent-200 dark:bg-accent-300/15 dark:text-accent-100 dark:ring-accent-300/20">
                  {profile.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt={profile.display_name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-bold">
                      {initials(profile.display_name)}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold tracking-tight text-foreground">
                      {profile.display_name}
                    </h3>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {(profile.university || profile.career) && (
                      <span className="inline-flex items-center gap-1.5">
                        <GraduationCap className="h-4 w-4" />
                        {[profile.university, profile.career].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    <StarRating
                      rating={profile.tutor_rating_avg ?? 0}
                      count={profile.tutor_rating_count ?? 0}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {subjectNames.map((subject) => (
                      <span
                        key={subject}
                        className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-white/5 dark:text-gray-300"
                      >
                        {subject}
                      </span>
                    ))}
                    {extraSubjects > 0 && (
                      <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-white/5 dark:text-gray-400">
                        +{extraSubjects}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {summarizeModalities(tutor.availability)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" />
                      {summarizeAvailability(tutor.availability)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-end">
                <div className="text-right">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    desde
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    ${formatArs(tutor.minHourlyRate)}
                  </p>
                  <p className="text-xs text-muted-foreground">ARS / hora</p>
                </div>

                <Link
                  href={`/tutores/${tutor.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713]"
                >
                  Ver perfil
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
