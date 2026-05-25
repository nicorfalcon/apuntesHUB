export interface Source {
  type: "note" | "web";
  label: string;
  url?: string;
  pages?: string;
}

export function SourcePills({ sources }: { sources: Source[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-medium text-gray-400 dark:text-sand-300/50">Fuentes:</span>
      {sources.map((source, i) => {
        const content = (
          <>
            <span>{source.type === "note" ? "📄" : "🌐"}</span>
            <span>{source.label}</span>
            {source.pages && <span>· pág. {source.pages}</span>}
          </>
        );

        const className =
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium " +
          (source.type === "note"
            ? "bg-accent-50 text-accent-700 dark:bg-accent-300/15 dark:text-accent-200"
            : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300");

        if (source.url) {
          return (
            <a
              key={i}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
              title={source.url}
            >
              {content}
            </a>
          );
        }

        return (
          <span key={i} className={className}>
            {content}
          </span>
        );
      })}
    </div>
  );
}
