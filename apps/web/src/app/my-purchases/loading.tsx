import { Skeleton } from "@/components/ui/skeleton";

export default function MyPurchasesLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-gray-200/80 bg-white/80 dark:border-white/10 dark:bg-[#0b1512]/80">
        <div className="mx-auto max-w-6xl px-4 py-9">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="mt-3 h-8 w-48 rounded-lg" />
          <Skeleton tone="soft" className="mt-3 h-4 w-80 max-w-full rounded" />

          <div className="mt-7 grid gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <Skeleton tone="soft" className="h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-12 rounded" />
                  <Skeleton tone="soft" className="h-3 w-20 rounded" />
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
              <Skeleton className="h-5 w-24 rounded" />
              <Skeleton tone="soft" className="mt-2 h-4 w-72 max-w-full rounded" />
            </div>
            <Skeleton tone="soft" className="h-9 w-32 rounded-lg" />
          </div>
          <div className="-mx-4 overflow-hidden px-4">
            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} tone="card" className="h-28 w-[220px] shrink-0 rounded-2xl" />
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-5 flex items-end justify-between border-b border-gray-200 pb-4 dark:border-white/10">
            <div>
              <Skeleton className="h-5 w-24 rounded" />
              <Skeleton tone="soft" className="mt-2 h-4 w-44 rounded" />
            </div>
            <Skeleton tone="soft" className="h-11 w-48 rounded-xl" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} tone="card" className="h-72 rounded-2xl" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
