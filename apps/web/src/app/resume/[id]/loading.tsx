import { Skeleton } from "@/components/ui/skeleton";

export default function ResumeLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Skeleton tone="soft" className="mb-6 h-4 w-48 rounded" />

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Main */}
        <div className="flex-1 space-y-8">
          <Skeleton tone="soft" className="h-80 w-full rounded-xl" />
          <div className="space-y-3">
            <Skeleton className="h-5 w-32 rounded" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} tone="soft" className="h-20 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-full shrink-0 lg:w-80">
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <Skeleton className="h-6 w-3/4 rounded" />
            <Skeleton tone="soft" className="h-4 w-full rounded" />
            <Skeleton tone="soft" className="h-4 w-1/2 rounded" />
            <Skeleton tone="soft" className="h-10 rounded-lg" />
            <Skeleton tone="none" className="h-10 rounded-lg bg-accent-100" />
          </div>
        </aside>
      </div>
    </div>
  );
}
