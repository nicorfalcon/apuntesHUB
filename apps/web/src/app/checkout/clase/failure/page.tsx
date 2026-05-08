import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function TutoringCheckoutFailurePage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string }>;
}) {
  const { booking_id } = await searchParams;

  let tutorId: string | null = null;

  if (booking_id) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: booking } = await supabase
        .from("tutor_bookings")
        .select("tutor_id")
        .eq("id", booking_id)
        .or(`student_id.eq.${user.id},tutor_id.eq.${user.id}`)
        .single();

      if (booking) {
        tutorId = booking.tutor_id;
      }
    }

  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
          <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">El pago no se completó</h1>
          <p className="text-sm text-muted-foreground">
            Hubo un problema procesando tu reserva. Podés intentar nuevamente.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          {tutorId && (
            <Link
              href={`/tutores/${tutorId}`}
              className="inline-flex w-full items-center justify-center rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 dark:bg-accent-500 dark:hover:bg-accent-600"
            >
              Volver al perfil del profesor
            </Link>
          )}
          <Link
            href="/explorar?tab=particulares"
            className={`inline-flex w-full items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
              tutorId 
                ? "border border-gray-200 bg-transparent text-foreground hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5" 
                : "bg-accent-600 text-white hover:bg-accent-700 dark:bg-accent-500 dark:hover:bg-accent-600"
            }`}
          >
            Volver a explorar profesores
          </Link>
        </div>
      </div>
    </div>
  );
}
