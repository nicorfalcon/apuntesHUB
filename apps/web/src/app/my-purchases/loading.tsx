export default function MyPurchasesLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-200" />
      <div className="mt-2 h-4 w-56 animate-pulse rounded bg-gray-100" />

      <div className="mt-8 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5">
            <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
