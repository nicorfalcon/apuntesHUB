import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReviewButton } from "./review-button";
import type { PurchaseWithResume } from "@/lib/database.types";

export default async function MisComprasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/my-purchases");

  const { data: purchases } = await supabase
    .from("purchases")
    .select(
      "*, resumes(title, subject, university, preview_url, profiles!seller_id(display_name)), reviews(id)"
    )
    .eq("buyer_id", user.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Mis compras
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Accedé a los apuntes que compraste.
      </p>

      {!purchases || purchases.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-gray-400">Todavía no compraste ningún apunte.</p>
          <Link
            href="/browse"
            className="mt-4 inline-block rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
          >
            Explorar apuntes
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {(purchases as PurchaseWithResume[]).map((purchase) => {
            const resume = purchase.resumes;
            const hasReview = (purchase.reviews?.length ?? 0) > 0;
            return (
              <div
                key={purchase.id}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5"
              >
                {resume?.preview_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resume.preview_url}
                    alt={resume.title}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-foreground">
                    {resume?.title}
                  </h3>
                  <p className="mt-0.5 text-sm text-gray-500">
                    por {resume?.profiles?.display_name} · {resume?.subject} · {resume?.university}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Comprado el {new Date(purchase.created_at).toLocaleDateString("es-AR")} ·{" "}
                    ${Number(purchase.amount).toLocaleString("es-AR")} ARS
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Link
                    href={`/my-purchases/${purchase.resume_id}/view`}
                    className="rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700"
                  >
                    Ver apunte
                  </Link>
                  {!hasReview && (
                    <ReviewButton
                      purchaseId={purchase.id}
                      resumeId={purchase.resume_id}
                      sellerId={purchase.seller_id}
                    />
                  )}
                  {hasReview && (
                    <span className="text-xs text-gray-400">Reseña enviada</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
