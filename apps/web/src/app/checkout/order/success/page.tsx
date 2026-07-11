import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderStatusPoller } from "./order-status-poller";

export default async function OrderCheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string; payment_id?: string; collection_id?: string }>;
}) {
  // MP vuelve con payment_id (y collection_id, su alias histórico). Se lo pasamos al
  // poller para que pueda confirmar el pago sin depender de que llegue el webhook.
  const { order_id, payment_id, collection_id } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!order_id) redirect("/my-purchases");

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", order_id)
    .eq("buyer_id", user.id)
    .single();

  if (!order) redirect("/my-purchases");

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <OrderStatusPoller
          orderId={order.id}
          paymentId={payment_id ?? collection_id ?? null}
        />
      </div>
    </div>
  );
}
