import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ViewerLayout } from "@/components/ui/viewer-layout";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("resumes")
    .select("title")
    .eq("id", params.id)
    .single();

  return {
    title: data?.title
      ? `${data.title} — apuntesHUB`
      : "Ver apunte — apuntesHUB",
  };
}

export default async function ViewPurchasePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?redirect=/my-purchases/${params.id}/view`);

  // Validar compra via RPC — también verifica que el resume existe y está publicado.
  // La URL firmada y el streaming del PDF los maneja /api/pdf/[id] server-side
  // para evitar exponer URLs de Supabase al browser.
  const { error: rpcError } = await supabase.rpc("get_resume_download_url", {
    p_resume_id: params.id,
  });

  if (rpcError) redirect("/my-purchases");

  // Datos del apunte con el perfil del vendedor
  const { data: resumeData } = await supabase
    .from("resumes")
    .select("*, profiles!seller_id(display_name, avatar_url)")
    .eq("id", params.id)
    .single();

  if (!resumeData) redirect("/my-purchases");

  const sellerProfile = resumeData.profiles as {
    display_name: string;
    avatar_url: string | null;
  } | null;

  // Estadísticas de reseñas para este apunte específico
  const { data: reviewsData } = await supabase
    .from("reviews")
    .select("rating")
    .eq("resume_id", params.id);

  const ratingCount = reviewsData?.length ?? 0;
  const ratingAvg =
    ratingCount > 0
      ? reviewsData!.reduce((sum, r) => sum + r.rating, 0) / ratingCount
      : 0;

  // Cantidad de apuntes publicados del vendedor
  const { count: sellerResumeCount } = await supabase
    .from("resumes")
    .select("*", { count: "exact", head: true })
    .eq("seller_id", resumeData.seller_id)
    .eq("status", "published");

  // Perfil del comprador (para el avatar en el navbar)
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <ViewerLayout
      pdfUrl={`/api/pdf/${params.id}`}
      userEmail={user.email ?? ""}
      userDisplayName={userProfile?.display_name ?? user.email ?? ""}
      userAvatarUrl={userProfile?.avatar_url ?? null}
      resume={{
        title: resumeData.title,
        subject: resumeData.subject,
        university: resumeData.university,
        career: resumeData.career,
        description: resumeData.description,
        updated_at: resumeData.updated_at,
      }}
      seller={{
        id: resumeData.seller_id,
        display_name: sellerProfile?.display_name ?? "Vendedor",
        avatar_url: sellerProfile?.avatar_url ?? null,
        resume_count: sellerResumeCount ?? 0,
      }}
      ratingAvg={ratingAvg}
      ratingCount={ratingCount}
    />
  );
}
