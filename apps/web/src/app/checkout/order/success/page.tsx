import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderStatusPoller } from "./order-status-poller";

export default async function OrderCheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string }>;
}) {
  const { order_id } = await searchParams;

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
        <OrderStatusPoller orderId={order.id} />
      </div>
    </div>
  );
}
