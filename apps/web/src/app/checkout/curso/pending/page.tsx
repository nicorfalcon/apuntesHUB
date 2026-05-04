import { redirect } from "next/navigation";

export default async function CourseCheckoutPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ enrollment_id?: string }>;
}) {
  const { enrollment_id } = await searchParams;
  // Reutilizamos el poller de éxito: muestra el estado real (pending → completed/failed).
  if (enrollment_id) redirect(`/checkout/curso/success?enrollment_id=${enrollment_id}`);
  redirect("/explorar?tab=grabadas");
}
