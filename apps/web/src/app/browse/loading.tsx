export default function BrowseLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <div className="h-8 w-52 animate-pulse rounded-lg bg-gray-200" />
          <div className="mt-2 h-4 w-80 animate-pulse rounded bg-gray-100" />
        </div>

        <div className="flex gap-8">
          {/* Sidebar skeleton */}
          <div className="hidden w-[280px] shrink-0 space-y-3 lg:block">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-gray-100" />
            ))}
          </div>

          {/* Grid skeleton */}
          <div className="min-w-0 flex-1">
            <div className="mb-5 h-10 animate-pulse rounded-full bg-gray-100" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <div className="h-44 animate-pulse bg-gray-100" />
                  <div className="space-y-2 p-4">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
                    <div className="h-4 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                    <div className="h-6 w-1/3 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
