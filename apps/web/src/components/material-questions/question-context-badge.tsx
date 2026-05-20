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
      <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-700 ring-1 ring-gray-200/80 dark:bg-white/[0.06] dark:text-sand-200 dark:ring-white/10">
        <FileText className="h-3 w-3" />
        {compact ? `Pág. ${page}` : `Página ${page}`}
      </span>
    );
  }

  if (typeof seconds === "number") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 font-mono text-[11px] font-bold text-gray-700 ring-1 ring-gray-200/80 dark:bg-white/[0.06] dark:text-sand-200 dark:ring-white/10">
        <Clock3 className="h-3 w-3" />
        {formatSeconds(seconds)}
      </span>
    );
  }

  return null;
}

export { formatSeconds };
