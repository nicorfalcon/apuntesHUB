import { Skeleton } from "@/components/ui/skeleton";

export default function BrowseLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <Skeleton className="h-8 w-52 rounded-lg" />
          <Skeleton tone="soft" className="mt-2 h-4 w-80 rounded" />
        </div>

        <div className="flex gap-8">
          {/* Sidebar skeleton */}
          <div className="hidden w-[280px] shrink-0 space-y-3 lg:block">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} tone="soft" className="h-4 rounded" />
            ))}
          </div>

          {/* Grid skeleton */}
          <div className="min-w-0 flex-1">
            <Skeleton tone="soft" className="mb-5 h-10 rounded-full" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <Skeleton tone="soft" className="h-44" />
                  <div className="space-y-2 p-4">
                    <Skeleton tone="soft" className="h-3 w-3/4 rounded" />
                    <Skeleton className="h-4 rounded" />
                    <Skeleton tone="soft" className="h-3 w-1/2 rounded" />
                    <Skeleton tone="soft" className="h-6 w-1/3 rounded" />
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
