import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/ui/star-rating";
import { PurchaseButton } from "./purchase-button";
import type { ResumeWithSeller, Review, Profile } from "@/lib/database.types";

export default async function ResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: resume } = await supabase
    .from("resumes")
    .select("*, profiles!seller_id(display_name, avatar_url, seller_rating_avg, seller_rating_count)")
    .eq("id", id)
    .single();

  if (!resume) notFound();

  const resumeWithSeller = resume as ResumeWithSeller;
  const { profiles: seller } = resumeWithSeller;

  // Verificar si el usuario ya compró este resumen
  let alreadyPurchased = false;
  if (user) {
    const { data: purchase } = await supabase
      .from("purchases")
      .select("id")
      .eq("buyer_id", user.id)
      .eq("resume_id", id)
      .eq("status", "completed")
      .single();
    alreadyPurchased = !!purchase;
  }

  // Reviews de este resumen
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*, profiles!reviewer_id(display_name)")
    .eq("resume_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const isOwnResume = user?.id === resumeWithSeller.seller_id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-gray-400">
        <Link href="/" className="hover:text-gray-600">Inicio</Link>
        <span className="mx-2">·</span>
        <Link href="/browse" className="hover:text-gray-600">Explorar</Link>
        <span className="mx-2">·</span>
        <span className="text-foreground">{resumeWithSeller.title}</span>
      </nav>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Contenido principal */}
        <div className="flex-1 space-y-8">
          {/* Preview */}
          {resumeWithSeller.preview_url ? (
            <div className="relative h-80 w-full overflow-hidden rounded-xl border border-gray-200">
              <Image
                src={resumeWithSeller.preview_url}
                alt={`Preview de ${resumeWithSeller.title}`}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-48 w-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50">
              <p className="text-sm text-gray-400">Sin preview disponible</p>
            </div>
          )}

          {/* Reviews */}
          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Reseñas ({reviews?.length ?? 0})
            </h2>
            {!reviews || reviews.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">Todavía no hay reseñas para este apunte.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {reviews.map((review) => {
                  const r = review as Review & { profiles: Pick<Profile, "display_name"> };
                  return (
                    <div key={r.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{r.profiles.display_name}</span>
                        <StarRating rating={r.rating} />
                      </div>
                      {r.comment && (
                        <p className="mt-2 text-sm text-gray-600">{r.comment}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(r.created_at).toLocaleDateString("es-AR")}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="w-full shrink-0 lg:w-80">
          <div className="sticky top-20 rounded-xl border border-gray-200 bg-white p-6 space-y-5">
            <div>
              <h1 className="text-xl font-bold text-foreground leading-tight">
                {resumeWithSeller.title}
              </h1>
              {resumeWithSeller.description && (
                <p className="mt-2 text-sm text-gray-500">{resumeWithSeller.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-100 text-xs font-semibold text-accent-700">
                {seller.display_name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <Link
                  href={`/profile/${resumeWithSeller.seller_id}`}
                  className="text-sm font-medium text-foreground hover:text-accent-600"
                >
                  {seller.display_name}
                </Link>
                <div className="mt-0.5">
                  <StarRating
                    rating={seller.seller_rating_avg ?? 0}
                    count={seller.seller_rating_count ?? 0}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-gray-100 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Universidad</span>
                <span className="font-medium">{resumeWithSeller.university}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Carrera</span>
                <span className="font-medium">{resumeWithSeller.career}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Materia</span>
                <span className="font-medium">{resumeWithSeller.subject}</span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <div className="text-2xl font-bold text-accent-700">
                ${resumeWithSeller.price.toLocaleString("es-AR")}{" "}
                <span className="text-sm font-normal text-gray-400">ARS</span>
              </div>

              {isOwnResume ? (
                <Link
                  href={`/sell/${resumeWithSeller.id}/edit`}
                  className="mt-4 flex w-full items-center justify-center rounded-lg border border-accent-600 py-2.5 text-sm font-semibold text-accent-600 hover:bg-accent-50"
                >
                  Editar apunte
                </Link>
              ) : alreadyPurchased ? (
                <Link
                  href={`/my-purchases`}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Ya comprado — ver mis compras
                </Link>
              ) : (
                <PurchaseButton
                  resumeId={resumeWithSeller.id}
                  isLoggedIn={!!user}
                />
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
