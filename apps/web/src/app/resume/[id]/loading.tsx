export default function ResumeLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 h-4 w-48 animate-pulse rounded bg-gray-100" />

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Main */}
        <div className="flex-1 space-y-8">
          <div className="h-80 w-full animate-pulse rounded-xl bg-gray-100" />
          <div className="space-y-3">
            <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-full shrink-0 lg:w-80">
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <div className="h-6 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
            <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-10 animate-pulse rounded-lg bg-accent-100" />
          </div>
        </aside>
      </div>
    </div>
  );
}
