import Link from "next/link";
import { XCircle } from "lucide-react";
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
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-sm dark:border-white/10 dark:bg-[#0f1e1a] sm:p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
          <XCircle className="h-8 w-8 text-red-700 dark:text-red-300" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">El pago no se completó</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            No se confirmó el pago de la clase. Podés volver al perfil del profesor e intentarlo nuevamente.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          {tutorId && (
            <Link
              href={`/tutores/${tutorId}`}
              className="inline-flex w-full items-center justify-center rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
            >
              Volver al perfil del profesor
            </Link>
          )}
          <Link
            href="/explorar?tab=particulares"
            className={`inline-flex w-full items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
              tutorId 
                ? "border border-gray-200 bg-transparent text-foreground hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5" 
                : "bg-accent-600 text-white hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
            }`}
          >
            Volver a explorar profesores
          </Link>
        </div>
      </div>
    </div>
  );
}
