export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
          <div className="mt-3 h-8 w-52 animate-pulse rounded-lg bg-gray-200 dark:bg-white/10" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-gray-100 dark:bg-white/5" />
        </div>
        <div className="h-10 w-40 animate-pulse rounded-xl bg-gray-100 dark:bg-white/10" />
      </div>

      <div className="mt-7 grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-100 dark:bg-white/10" />
            <div className="mt-4 h-3 w-24 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
            <div className="mt-2 h-7 w-20 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
          </div>
        ))}
      </div>

      <div className="mt-10">
        <div className="mb-5 border-b border-gray-200 pb-4 dark:border-white/10">
          <div className="h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
          <div className="-mx-4 mt-4 overflow-hidden px-4">
            <div className="flex gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 min-w-[210px] flex-1 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                />
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
                <div className="h-14 w-20 animate-pulse rounded-xl bg-gray-100 dark:bg-white/10" />
                <div className="space-y-2">
                  <div className="h-4 w-48 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                  <div className="h-3 w-32 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
                </div>
              </div>
              <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-100 dark:bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
