import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="mt-3 h-8 w-52 rounded-lg" />
          <Skeleton tone="soft" className="mt-3 h-4 w-80 max-w-full rounded" />
        </div>
        <Skeleton tone="soft" className="h-10 w-40 rounded-xl" />
      </div>

      <div className="mt-7 grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <Skeleton tone="soft" className="h-10 w-10 rounded-xl" />
            <Skeleton tone="soft" className="mt-4 h-3 w-24 rounded" />
            <Skeleton className="mt-2 h-7 w-20 rounded" />
            <Skeleton tone="soft" className="mt-2 h-3 w-32 rounded" />
          </div>
        ))}
      </div>

      <div className="mt-10">
        <div className="mb-5 border-b border-gray-200 pb-4 dark:border-white/10">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton tone="soft" className="mt-2 h-4 w-64 rounded" />
          <div className="-mx-4 mt-4 overflow-hidden px-4">
            <div className="flex gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} tone="card" className="h-20 min-w-[210px] flex-1 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex items-center gap-3">
                <Skeleton tone="soft" className="h-14 w-20 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48 rounded" />
                  <Skeleton tone="soft" className="h-3 w-32 rounded" />
                </div>
              </div>
              <Skeleton tone="soft" className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
