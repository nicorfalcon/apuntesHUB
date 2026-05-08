import { redirect } from "next/navigation";

export default async function TutoringCheckoutPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string }>;
}) {
  const { booking_id } = await searchParams;
  
  // Reutilizamos el poller de éxito que muestra el estado real y se actualiza de pending -> confirmed/failed
  if (booking_id) {
    redirect(`/checkout/clase/success?booking_id=${booking_id}`);
  }
  
  redirect("/explorar?tab=particulares");
}
