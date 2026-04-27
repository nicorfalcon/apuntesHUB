import { createClient } from "@/lib/supabase/server";
import ExplorarClient from "@/components/explore/ExplorarClient";
import type { ResumeWithSeller } from "@/lib/database.types";

export default async function ExplorarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: resumes } = await supabase
    .from("resumes")
    .select(
      "*, profiles!seller_id(display_name, avatar_url, seller_rating_avg, seller_rating_count)"
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  let purchasedIds: string[] = [];
  if (user) {
    const { data: purchases } = await supabase
      .from("purchases")
      .select("resume_id")
      .eq("buyer_id", user.id)
      .eq("status", "completed");
    purchasedIds =
      (purchases as { resume_id: string }[] | null)?.map((p) => p.resume_id) ??
      [];
  }

  return (
    <ExplorarClient
      resumes={(resumes as ResumeWithSeller[]) ?? []}
      purchasedIds={purchasedIds}
    />
  );
}
