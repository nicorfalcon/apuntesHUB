import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PurchaseStatusPoller } from "./purchase-status-poller";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase_id?: string }>;
}) {
  const { purchase_id } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!purchase_id) redirect("/explorar");

  // Verificar que la compra pertenece al usuario
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, status")
    .eq("id", purchase_id)
    .eq("buyer_id", user.id)
    .single();

  if (!purchase) redirect("/explorar");

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <PurchaseStatusPoller purchaseId={purchase.id} />
      </div>
    </div>
  );
}
