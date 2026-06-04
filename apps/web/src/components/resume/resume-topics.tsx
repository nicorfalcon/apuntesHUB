import { normalizeResumeTopics } from "@/lib/resumes/topics";

interface ResumeTopicChipsProps {
  topics: unknown;
  maxVisible?: number;
  className?: string;
  chipClassName?: string;
  overflowClassName?: string;
}

export function getDisplayResumeTopics(topics: unknown): string[] {
  return normalizeResumeTopics(topics);
}

export function ResumeTopicChips({
  topics,
  maxVisible,
  className = "",
  chipClassName = "",
  overflowClassName = "",
}: ResumeTopicChipsProps) {
  const displayTopics = getDisplayResumeTopics(topics);
  const visibleTopics =
    typeof maxVisible === "number" ? displayTopics.slice(0, maxVisible) : displayTopics;
  const hiddenCount = displayTopics.length - visibleTopics.length;

  if (displayTopics.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {visibleTopics.map((topic, index) => (
        <span
          key={`${topic}-${index}`}
          className={`inline-flex max-w-full items-center rounded-lg bg-accent-100 px-2.5 py-1 text-xs font-medium text-accent-700 ring-1 ring-inset ring-accent-200/60 dark:bg-accent-300/15 dark:text-accent-100 dark:ring-accent-300/20 ${chipClassName}`}
        >
          <span className="truncate">{topic}</span>
        </span>
      ))}
      {hiddenCount > 0 && (
        <span
          className={`inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500 ring-1 ring-inset ring-gray-200/70 dark:bg-white/[0.06] dark:text-sand-300/75 dark:ring-white/10 ${overflowClassName}`}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}

interface ResumeTopicsSectionProps {
  topics: unknown;
  className?: string;
  headingClassName?: string;
}

export function ResumeTopicsSection({
  topics,
  className = "",
  headingClassName = "text-lg font-semibold text-foreground",
}: ResumeTopicsSectionProps) {
  const displayTopics = getDisplayResumeTopics(topics);

  if (displayTopics.length === 0) return null;

  return (
    <section className={className}>
      <h2 className={headingClassName}>Temas del apunte</h2>
      <ResumeTopicChips topics={displayTopics} className="mt-3" />
    </section>
  );
}
