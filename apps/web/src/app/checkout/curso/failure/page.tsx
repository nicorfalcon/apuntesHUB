import Link from "next/link";

export default async function CourseCheckoutFailurePage({
  searchParams,
}: {
  searchParams: Promise<{ enrollment_id?: string }>;
}) {
  const { enrollment_id } = await searchParams;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">El pago no se pudo procesar</h1>
        <p className="text-sm text-muted-foreground">
          Hubo un problema con tu pago. Podés intentar nuevamente.
        </p>
        <Link
          href={enrollment_id ? `/cursos` : "/explorar?tab=grabadas"}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
        >
          Volver a cursos
        </Link>
      </div>
    </div>
  );
}
