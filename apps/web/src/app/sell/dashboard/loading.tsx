export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-9 w-36 animate-pulse rounded-lg bg-gray-100" />
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* List */}
      <div className="mt-8 space-y-3">
        <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
            <div className="space-y-1.5">
              <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-16 animate-pulse rounded-lg bg-gray-100" />
              <div className="h-8 w-16 animate-pulse rounded-lg bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
