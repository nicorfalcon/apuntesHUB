export default function MyPurchasesLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-gray-200/80 bg-white/80 dark:border-white/10 dark:bg-[#0b1512]/80">
        <div className="mx-auto max-w-6xl px-4 py-9">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
          <div className="mt-3 h-8 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-white/10" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-gray-100 dark:bg-white/5" />

          <div className="mt-7 grid gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-100 dark:bg-white/10" />
                <div className="space-y-2">
                  <div className="h-5 w-12 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-9 px-4 py-8">
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <div className="h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
              <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-gray-100 dark:bg-white/5" />
            </div>
            <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-100 dark:bg-white/10" />
          </div>
          <div className="-mx-4 overflow-hidden px-4">
            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 w-[220px] shrink-0 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                />
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-5 flex items-end justify-between border-b border-gray-200 pb-4 dark:border-white/10">
            <div>
              <div className="h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
              <div className="mt-2 h-4 w-44 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
            </div>
            <div className="h-11 w-48 animate-pulse rounded-xl bg-gray-100 dark:bg-white/10" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-72 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
