"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronDown,
  GraduationCap,
  PlayCircle,
  UserRound,
} from "lucide-react";
import { ResumeCard } from "@/components/resume/resume-card";
import type { ResumeWithSeller } from "@/lib/database.types";
import {
  ApuntesToolbar,
  type FilterOption,
  type PriceRange,
} from "./apuntes-toolbar";
import {
  ParticularesToolbar,
  type TutorAvailabilityFilter,
  type TutorModality,
  type TutorRateRange,
} from "./particulares-toolbar";
import {
  GrabadasToolbar,
  type CourseDurationFilter,
  type CourseTypeOption,
  type CourseTypeFilter,
} from "./grabadas-toolbar";
import { TutorList } from "@/components/tutors/tutor-list";
import type { TutorListItem } from "@/components/tutors/types";
import { CourseList } from "@/components/courses/course-list";
import { formatCourseType } from "@/components/courses/format";
import type { RecordedCourseItem } from "@/components/courses/types";
import { closeOtherExploreDropdowns } from "./dropdown-utils";
import { useE2EHydrationReady } from "@/lib/e2e/use-e2e-hydration-ready";

export type ExploreTab = "apuntes" | "particulares" | "grabadas";

type SortKey = "recent" | "price_asc" | "price_desc" | "rating";

interface ExploreTabsProps {
  activeTab: ExploreTab;
  resumes: ResumeWithSeller[];
  tutors: TutorListItem[];
  courses: RecordedCourseItem[];
  purchasedIds: string[];
  initialCareer?: string;
}

const TABS: {
  id: ExploreTab;
  label: string;
  description: string;
  icon: typeof BookOpen;
}[] = [
  {
    id: "apuntes",
    label: "Apuntes",
    description: "Resúmenes, guías y material de estudio.",
    icon: BookOpen,
  },
  {
    id: "particulares",
    label: "Profesores particulares",
    description: "Profes acreditados para clases 1-a-1.",
    icon: UserRound,
  },
  {
    id: "grabadas",
    label: "Grabadas",
    description: "Cursos en video para preparar materias.",
    icon: PlayCircle,
  },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Más recientes" },
  { value: "rating", label: "Mejor valorados" },
  { value: "price_asc", label: "Menor precio" },
  { value: "price_desc", label: "Mayor precio" },
];

function buildOptions(items: string[]): FilterOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item) continue;
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function toggleSetValue<TValue extends string>(
  setter: Dispatch<SetStateAction<Set<TValue>>>,
  value: TValue
) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });
}

function matchesPriceRange(price: number, range: PriceRange) {
  if (range === "all") return true;
  if (range === "free") return price === 0;
  if (range === "under_10000") return price > 0 && price <= 10000;
  if (range === "10000_30000") return price > 10000 && price <= 30000;
  return price > 30000;
}

function buildTutorSubjectOptions(tutors: TutorListItem[]): FilterOption[] {
  const counts = new Map<string, { label: string; count: number }>();

  for (const tutor of tutors) {
    const seenForTutor = new Set<string>();

    for (const item of tutor.subjects) {
      if (seenForTutor.has(item.subject.id)) continue;
      seenForTutor.add(item.subject.id);
      const current = counts.get(item.subject.id);
      counts.set(item.subject.id, {
        label: item.subject.name,
        count: (current?.count ?? 0) + 1,
      });
    }
  }

  return Array.from(counts.entries())
    .map(([value, option]) => ({ value, label: option.label, count: option.count }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function buildCourseTypeOptions(courses: RecordedCourseItem[]): CourseTypeOption[] {
  const counts = new Map<string, number>();
  for (const course of courses) {
    counts.set(course.course_type, (counts.get(course.course_type) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([value]) =>
      ["curso_completo", "repaso_final", "resolucion_tps"].includes(value)
    )
    .map(([value, count]) => ({
      value: value as CourseTypeFilter,
      label: formatCourseType(value),
      count,
    }));
}

function matchesTutorRate(rate: number, range: TutorRateRange) {
  if (range === "all") return true;
  if (range === "under_8000") return rate <= 8000;
  if (range === "8000_15000") return rate > 8000 && rate <= 15000;
  return rate > 15000;
}

function matchesTutorAvailability(
  tutor: TutorListItem,
  availability: TutorAvailabilityFilter
) {
  if (availability === "all") return true;

  return tutor.availability.some((slot) => {
    if (availability === "weekend") {
      return slot.day_of_week === 0 || slot.day_of_week === 6;
    }

    return slot.day_of_week >= 1 && slot.day_of_week <= 5;
  });
}

function matchesTutorModalities(
  tutor: TutorListItem,
  selectedModalities: Set<TutorModality>
) {
  if (selectedModalities.size === 0) return true;

  return tutor.availability.some((slot) => {
    if (selectedModalities.has("ambas") && slot.modality === "ambas") {
      return true;
    }
    if (
      selectedModalities.has("online") &&
      (slot.modality === "online" || slot.modality === "ambas")
    ) {
      return true;
    }
    if (
      selectedModalities.has("presencial") &&
      (slot.modality === "presencial" || slot.modality === "ambas")
    ) {
      return true;
    }

    return false;
  });
}

function matchesCourseDuration(
  totalSeconds: number,
  duration: CourseDurationFilter
) {
  if (duration === "all") return true;
  if (duration === "under_2h") return totalSeconds <= 2 * 60 * 60;
  if (duration === "2_6h") {
    return totalSeconds > 2 * 60 * 60 && totalSeconds <= 6 * 60 * 60;
  }
  return totalSeconds > 6 * 60 * 60;
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: "tutors" | "courses";
  title: string;
  description: string;
}) {
  const Icon = icon === "tutors" ? GraduationCap : PlayCircle;

  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-dashed border-gray-200 bg-white/70 px-6 text-center dark:border-white/10 dark:bg-white/[0.03]">
      <div className="max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50 text-accent-700 ring-1 ring-accent-100 dark:bg-accent-300/10 dark:text-accent-200 dark:ring-accent-300/15">
          <Icon className="h-7 w-7" strokeWidth={1.7} />
        </div>
        <p className="mt-6 text-3xl font-bold leading-tight text-foreground md:text-4xl">
          {title}
        </p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export function ExploreTabs({
  activeTab,
  resumes,
  tutors,
  courses,
  purchasedIds,
  initialCareer,
}: ExploreTabsProps) {
  useE2EHydrationReady();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [selectedUniversities, setSelectedUniversities] = useState<Set<string>>(
    new Set()
  );
  const [selectedCareers, setSelectedCareers] = useState<Set<string>>(new Set());
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<PriceRange>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [tutorQuery, setTutorQuery] = useState("");
  const [selectedTutorModalities, setSelectedTutorModalities] = useState<
    Set<TutorModality>
  >(new Set());
  const [selectedTutorSubjects, setSelectedTutorSubjects] = useState<Set<string>>(
    new Set()
  );
  const [tutorAvailability, setTutorAvailability] =
    useState<TutorAvailabilityFilter>("all");
  const [tutorRateRange, setTutorRateRange] = useState<TutorRateRange>("all");
  const [aiSearch, setAiSearch] = useState(false);
  const [aiResultIds, setAiResultIds] = useState<string[] | null>(null);
  const [aiScores, setAiScores] = useState<Record<string, number>>({});
  const [aiSearchLoading, setAiSearchLoading] = useState(false);

  const [courseQuery, setCourseQuery] = useState("");
  const [selectedCourseTypes, setSelectedCourseTypes] = useState<
    Set<CourseTypeFilter>
  >(new Set());
  const [selectedCourseSubjects, setSelectedCourseSubjects] = useState<Set<string>>(
    new Set()
  );
  const [selectedCourseUniversities, setSelectedCourseUniversities] = useState<
    Set<string>
  >(new Set());
  const [courseDuration, setCourseDuration] =
    useState<CourseDurationFilter>("all");

  useEffect(() => {
    if (!initialCareer) return;
    const needle = initialCareer.toLowerCase();
    const matchedCareers = Array.from(new Set(resumes.map((resume) => resume.career)))
      .filter((career) => career.toLowerCase().includes(needle));
    if (matchedCareers.length > 0) setSelectedCareers(new Set(matchedCareers));
  }, [initialCareer, resumes]);

  useEffect(() => {
    if (!aiSearch || !query.trim()) {
      setAiResultIds(null);
      setAiScores({});
      setAiSearchLoading(false);
      return;
    }

    setAiSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/ai/browse-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim() }),
        });

        if (!res.ok) {
          setAiResultIds([]);
          return;
        }

        const data = await res.json();
        const results: Array<{ resumeId: string; similarity: number }> =
          data.results ?? [];

        setAiResultIds(results.map((r) => r.resumeId));
        setAiScores(
          Object.fromEntries(results.map((r) => [r.resumeId, r.similarity]))
        );
      } catch {
        setAiResultIds([]);
      } finally {
        setAiSearchLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, aiSearch]);

  function handleAiSearchChange(value: boolean) {
    setAiSearch(value);
    if (!value) {
      setAiResultIds(null);
      setAiScores({});
    }
  }

  const purchasedSet = useMemo(() => new Set(purchasedIds), [purchasedIds]);

  const universities = useMemo(
    () => buildOptions(resumes.map((resume) => resume.university)),
    [resumes]
  );
  const careers = useMemo(
    () => buildOptions(resumes.map((resume) => resume.career)),
    [resumes]
  );
  const subjects = useMemo(
    () => buildOptions(resumes.map((resume) => resume.subject)),
    [resumes]
  );
  const tutorSubjectOptions = useMemo(
    () => buildTutorSubjectOptions(tutors),
    [tutors]
  );
  const courseTypeOptions = useMemo(
    () => buildCourseTypeOptions(courses),
    [courses]
  );
  const courseSubjectOptions = useMemo(
    () =>
      buildOptions(
        courses
          .map((course) => course.subjects?.name ?? "")
          .filter(Boolean)
      ),
    [courses]
  );
  const courseUniversityOptions = useMemo(
    () =>
      buildOptions(
        courses
          .map((course) => course.subjects?.university ?? "")
          .filter(Boolean)
      ),
    [courses]
  );

  const filteredResumes = useMemo(() => {
    let result = [...resumes];

    if (aiSearch) {
      if (aiResultIds === null) {
        result = query.trim() ? [] : result;
      } else if (aiResultIds.length === 0) {
        result = [];
      } else {
        const idSet = new Set(aiResultIds);
        result = result.filter((r) => idSet.has(r.id));
        result.sort((a, b) => (aiScores[b.id] ?? 0) - (aiScores[a.id] ?? 0));
      }
    } else {
      const normalizedQuery = query.trim().toLowerCase();
      result = result.filter((resume) => {
        if (
          selectedUniversities.size > 0 &&
          !selectedUniversities.has(resume.university)
        ) return false;
        if (selectedCareers.size > 0 && !selectedCareers.has(resume.career)) return false;
        if (selectedSubjects.size > 0 && !selectedSubjects.has(resume.subject)) return false;
        if (!matchesPriceRange(Number(resume.price), priceRange)) return false;

        if (normalizedQuery) {
          const sellerName = resume.profiles?.display_name ?? "";
          const haystack = [resume.title, resume.subject, resume.university, resume.career, sellerName]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(normalizedQuery)) return false;
        }

        return true;
      });

      result.sort((a, b) => {
        if (sort === "price_asc") return Number(a.price) - Number(b.price);
        if (sort === "price_desc") return Number(b.price) - Number(a.price);
        if (sort === "rating") {
          const ratingDiff = Number(b.rating_avg ?? 0) - Number(a.rating_avg ?? 0);
          if (ratingDiff !== 0) return ratingDiff;
          return Number(b.rating_count ?? 0) - Number(a.rating_count ?? 0);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return result;
  }, [
    resumes,
    query,
    selectedUniversities,
    selectedCareers,
    selectedSubjects,
    priceRange,
    sort,
    aiSearch,
    aiResultIds,
    aiScores,
  ]);

  const activeFilterCount =
    selectedUniversities.size +
    selectedCareers.size +
    selectedSubjects.size +
    (priceRange === "all" ? 0 : 1);
  const filteredTutors = useMemo(() => {
    const normalizedQuery = tutorQuery.trim().toLowerCase();

    return tutors.filter((tutor) => {
      if (!matchesTutorModalities(tutor, selectedTutorModalities)) return false;
      if (!matchesTutorAvailability(tutor, tutorAvailability)) return false;
      if (!matchesTutorRate(tutor.minHourlyRate, tutorRateRange)) return false;

      if (
        selectedTutorSubjects.size > 0 &&
        !tutor.subjects.some((item) => selectedTutorSubjects.has(item.subject.id))
      ) {
        return false;
      }

      if (normalizedQuery) {
        const haystack = [
          tutor.profile.display_name,
          tutor.profile.university ?? "",
          tutor.profile.career ?? "",
          ...tutor.subjects.map((item) => item.subject.name),
          ...tutor.subjects.map((item) => item.subject.university),
          ...tutor.subjects.map((item) => item.subject.career ?? ""),
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(normalizedQuery)) return false;
      }

      return true;
    });
  }, [
    tutors,
    tutorQuery,
    selectedTutorModalities,
    selectedTutorSubjects,
    tutorAvailability,
    tutorRateRange,
  ]);

  const activeTutorFilterCount =
    selectedTutorModalities.size +
    selectedTutorSubjects.size +
    (tutorAvailability === "all" ? 0 : 1) +
    (tutorRateRange === "all" ? 0 : 1);
  const filteredCourses = useMemo(() => {
    const normalizedQuery = courseQuery.trim().toLowerCase();

    return courses.filter((course) => {
      if (
        selectedCourseTypes.size > 0 &&
        !selectedCourseTypes.has(course.course_type as CourseTypeFilter)
      ) {
        return false;
      }
      if (
        selectedCourseSubjects.size > 0 &&
        !selectedCourseSubjects.has(course.subjects?.name ?? "")
      ) {
        return false;
      }
      if (
        selectedCourseUniversities.size > 0 &&
        !selectedCourseUniversities.has(course.subjects?.university ?? "")
      ) {
        return false;
      }
      if (!matchesCourseDuration(course.total_duration_seconds, courseDuration)) {
        return false;
      }

      if (normalizedQuery) {
        const haystack = [
          course.title,
          course.description ?? "",
          course.subjects?.name ?? "",
          course.subjects?.university ?? "",
          course.subjects?.career ?? "",
          course.profiles?.display_name ?? "",
          formatCourseType(course.course_type),
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(normalizedQuery)) return false;
      }

      return true;
    });
  }, [
    courses,
    courseQuery,
    selectedCourseTypes,
    selectedCourseSubjects,
    selectedCourseUniversities,
    courseDuration,
  ]);

  const activeCourseFilterCount =
    selectedCourseTypes.size +
    selectedCourseSubjects.size +
    selectedCourseUniversities.size +
    (courseDuration === "all" ? 0 : 1);

  function clearFilters() {
    setQuery("");
    setSelectedUniversities(new Set());
    setSelectedCareers(new Set());
    setSelectedSubjects(new Set());
    setPriceRange("all");
    setAiSearch(false);
    setAiResultIds(null);
    setAiScores({});
  }

  function clearTutorFilters() {
    setTutorQuery("");
    setSelectedTutorModalities(new Set());
    setSelectedTutorSubjects(new Set());
    setTutorAvailability("all");
    setTutorRateRange("all");
  }

  function clearCourseFilters() {
    setCourseQuery("");
    setSelectedCourseTypes(new Set());
    setSelectedCourseSubjects(new Set());
    setSelectedCourseUniversities(new Set());
    setCourseDuration("all");
  }

  function switchTab(nextTab: ExploreTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const totalLabel =
    activeTab === "apuntes"
      ? `${filteredResumes.length} apunte${filteredResumes.length === 1 ? "" : "s"} encontrado${
          filteredResumes.length === 1 ? "" : "s"
        }`
      : activeTab === "particulares"
      ? `${filteredTutors.length} profesor${
          filteredTutors.length === 1 ? "" : "es"
        } particular${filteredTutors.length === 1 ? "" : "es"} encontrado${
          filteredTutors.length === 1 ? "" : "s"
        }`
      : `${filteredCourses.length} curso${filteredCourses.length === 1 ? "" : "s"} grabado${
          filteredCourses.length === 1 ? "" : "s"
        } encontrado${filteredCourses.length === 1 ? "" : "s"}`;

  function handleSortSelect(
    event: React.MouseEvent<HTMLButtonElement>,
    nextSort: SortKey
  ) {
    setSort(nextSort);
    event.currentTarget.closest("details")?.removeAttribute("open");
  }

  return (
    <div className="min-h-screen bg-background" data-explore-dropdown-root>
      <section className="mx-auto w-full max-w-6xl px-4 py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h1 className="text-5xl font-bold leading-none text-foreground md:text-6xl lg:text-7xl">
              Explorar
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Encontrá apuntes, profesores y cursos grabados para preparar mejor
              cada materia.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Verticales del catálogo"
            className="flex w-full gap-1 overflow-x-auto rounded-full border border-gray-200 bg-[var(--surface-warm)] p-1 dark:border-white/10 lg:w-auto"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => switchTab(tab.id)}
                  className={`inline-flex min-w-max items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-accent-600 text-white shadow-sm dark:bg-accent-300 dark:text-[#071713]"
                      : "text-gray-500 hover:bg-white/80 hover:text-foreground dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200/80 pt-6 dark:border-white/10">
          {activeTab === "apuntes" ? (
            <ApuntesToolbar
              query={query}
              onQueryChange={setQuery}
              universities={universities}
              careers={careers}
              subjects={subjects}
              selectedUniversities={selectedUniversities}
              selectedCareers={selectedCareers}
              selectedSubjects={selectedSubjects}
              priceRange={priceRange}
              activeFilterCount={activeFilterCount}
              onToggleUniversity={(value) =>
                toggleSetValue(setSelectedUniversities, value)
              }
              onToggleCareer={(value) => toggleSetValue(setSelectedCareers, value)}
              onToggleSubject={(value) => toggleSetValue(setSelectedSubjects, value)}
              onPriceRangeChange={setPriceRange}
              onClear={clearFilters}
              aiSearch={aiSearch}
              onAiSearchChange={handleAiSearchChange}
              aiSearchLoading={aiSearchLoading}
            />
          ) : activeTab === "particulares" ? (
            <ParticularesToolbar
              query={tutorQuery}
              onQueryChange={setTutorQuery}
              subjects={tutorSubjectOptions}
              selectedModalities={selectedTutorModalities}
              selectedSubjects={selectedTutorSubjects}
              availability={tutorAvailability}
              rateRange={tutorRateRange}
              activeFilterCount={activeTutorFilterCount}
              onToggleModality={(value) =>
                toggleSetValue(setSelectedTutorModalities, value)
              }
              onToggleSubject={(value) =>
                toggleSetValue(setSelectedTutorSubjects, value)
              }
              onAvailabilityChange={setTutorAvailability}
              onRateRangeChange={setTutorRateRange}
              onClear={clearTutorFilters}
            />
          ) : (
            <GrabadasToolbar
              query={courseQuery}
              onQueryChange={setCourseQuery}
              types={courseTypeOptions}
              subjects={courseSubjectOptions}
              universities={courseUniversityOptions}
              selectedTypes={selectedCourseTypes}
              selectedSubjects={selectedCourseSubjects}
              selectedUniversities={selectedCourseUniversities}
              duration={courseDuration}
              activeFilterCount={activeCourseFilterCount}
              onToggleType={(value) => toggleSetValue(setSelectedCourseTypes, value)}
              onToggleSubject={(value) =>
                toggleSetValue(setSelectedCourseSubjects, value)
              }
              onToggleUniversity={(value) =>
                toggleSetValue(setSelectedCourseUniversities, value)
              }
              onDurationChange={setCourseDuration}
              onClear={clearCourseFilters}
            />
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg font-semibold text-foreground">
            {totalLabel}
          </p>
          {activeTab === "apuntes" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Ordenar</span>
              <details
                className="group relative"
                data-explore-dropdown
                onToggle={closeOtherExploreDropdowns}
              >
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-foreground outline-none transition-colors hover:border-accent-300 hover:bg-accent-50/70 focus-visible:ring-2 focus-visible:ring-accent-200/70 dark:border-white/10 dark:bg-[#0f1e1a] dark:hover:border-accent-300/40 dark:hover:bg-accent-300/10 dark:focus-visible:ring-accent-300/20">
                  {SORT_OPTIONS.find((option) => option.value === sort)?.label}
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-48 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl shadow-black/10 dark:border-white/10 dark:bg-[#0f1e1a] dark:shadow-black/35">
                  {SORT_OPTIONS.map((option) => {
                    const selected = option.value === sort;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={(event) => handleSortSelect(event, option.value)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                          selected
                            ? "bg-accent-50 font-semibold text-accent-700 dark:bg-accent-300/15 dark:text-accent-100"
                            : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                        }`}
                      >
                        <span>{option.label}</span>
                        {selected && <Check className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
              </details>
            </div>
          )}
        </div>

        <div className="mt-6">
          {activeTab === "apuntes" ? (
            aiSearchLoading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[220px] animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />
                ))}
              </div>
            ) : filteredResumes.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-gray-200 bg-white/70 px-6 py-16 text-center dark:border-white/10 dark:bg-white/[0.03]">
                {aiSearch && query.trim() ? (
                  <>
                    <p className="text-3xl font-bold text-foreground">
                      No encontramos apuntes sobre ese tema
                    </p>
                    <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                      Probá con otros términos o desactivá &ldquo;Buscar por tema&rdquo; para buscar por título.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAiSearchChange(false)}
                      className="mt-6 rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-gray-50"
                    >
                      Buscar por título
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-foreground">
                      No encontramos apuntes
                    </p>
                    <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                      Probá limpiar filtros o buscar por otra materia, autor o
                      universidad.
                    </p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-6 rounded-full bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713]"
                    >
                      Limpiar filtros
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredResumes.map((resume) => (
                  <ResumeCard
                    key={resume.id}
                    resume={resume}
                    purchased={purchasedSet.has(resume.id)}
                  />
                ))}
              </div>
            )
          ) : activeTab === "particulares" ? (
            filteredTutors.length > 0 ? (
              <TutorList tutors={filteredTutors} />
            ) : tutors.length > 0 ? (
              <div className="rounded-[28px] border border-dashed border-gray-200 bg-white/70 px-6 py-16 text-center dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-3xl font-bold text-foreground">
                  No encontramos profesores
                </p>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                  Probá limpiar filtros o buscar por otra materia, modalidad o
                  rango de precio.
                </p>
                <button
                  type="button"
                  onClick={clearTutorFilters}
                  className="mt-6 rounded-full bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713]"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <EmptyState
                icon="tutors"
                title="Todavía no hay profesores particulares"
                description="Cuando los primeros profesores publiquen sus materias, van a aparecer acá con filtros por modalidad, disponibilidad y tarifa."
              />
            )
          ) : (
            filteredCourses.length > 0 ? (
              <CourseList courses={filteredCourses} />
            ) : courses.length > 0 ? (
              <div className="rounded-[28px] border border-dashed border-gray-200 bg-white/70 px-6 py-16 text-center dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-3xl font-bold text-foreground">
                  No encontramos cursos
                </p>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                  Probá limpiar filtros o buscar por otra materia, universidad
                  o autor.
                </p>
                <button
                  type="button"
                  onClick={clearCourseFilters}
                  className="mt-6 rounded-full bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713]"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <EmptyState
                icon="courses"
                title="Todavía no hay cursos grabados"
                description="Cuando los primeros autores publiquen cursos con módulos, van a aparecer acá con filtros por tipo, duración y materia."
              />
            )
          )}
        </div>
      </section>
    </div>
  );
}
