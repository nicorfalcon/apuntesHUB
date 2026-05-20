import { Clock3, FileText } from "lucide-react";

function formatSeconds(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function QuestionContextBadge({
  page,
  seconds,
  compact = false,
}: {
  page?: number | null;
  seconds?: number | null;
  compact?: boolean;
}) {
  if (typeof page === "number") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-accent-50 px-2 py-1 text-[11px] font-bold text-accent-700 ring-1 ring-accent-100 dark:bg-accent-300/10 dark:text-accent-100 dark:ring-accent-300/15">
        <FileText className="h-3.5 w-3.5" />
        {compact ? `Pág. ${page}` : `Página ${page}`}
      </span>
    );
  }

  if (typeof seconds === "number") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-accent-50 px-2 py-1 text-[11px] font-bold text-accent-700 ring-1 ring-accent-100 dark:bg-accent-300/10 dark:text-accent-100 dark:ring-accent-300/15">
        <Clock3 className="h-3.5 w-3.5" />
        {formatSeconds(seconds)}
      </span>
    );
  }

  return null;
}

export { formatSeconds };
