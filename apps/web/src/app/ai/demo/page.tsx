import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DemoClient } from "./demo-client";

export default async function AIDemoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/ai/demo");

  const { data: purchases } = await supabase
    .from("purchases")
    .select("resume_id, resumes(id, title, subject)")
    .eq("buyer_id", user.id)
    .eq("status", "completed");

  type PurchaseRow = {
    resume_id: string;
    resumes: { id: string; title: string; subject: string } | null;
  };

  const resumes =
    (purchases as PurchaseRow[] | null)
      ?.map((p) => p.resumes)
      .filter((r): r is { id: string; title: string; subject: string } => r !== null) ?? [];

  return <DemoClient resumes={resumes} />;
}
