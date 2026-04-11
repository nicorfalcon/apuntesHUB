export default function Loading() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="mb-4 h-4 w-40 rounded bg-gray-200" />
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gray-200" />
            <div>
              <div className="h-6 w-48 rounded bg-gray-200" />
              <div className="mt-1.5 h-4 w-20 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="h-44 bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
