import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReviewButton } from "./review-button";
import type { PurchaseWithResume } from "@/lib/database.types";

function BookOpenIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
    </svg>
  );
}

function ShoppingBagIcon() {
  return (
    <svg className="h-16 w-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

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

  const list = (purchases as PurchaseWithResume[]) ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
                Mis compras
              </h1>
              <p className="mt-1.5 text-sm text-gray-500">
                Accedé a los apuntes que compraste en cualquier momento.
              </p>
            </div>

            {list.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-center">
                <p className="text-xl font-bold text-foreground">{list.length}</p>
                <p className="text-xs text-gray-500">
                  {list.length === 1 ? "apunte" : "apuntes"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="mx-auto max-w-5xl px-4 py-10">
        {list.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <ShoppingBagIcon />
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              Todavía no compraste ningún apunte
            </h2>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
              Explorá el marketplace y encontrá el material que necesitás para
              tus materias.
            </p>
            <Link
              href="/browse"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
            >
              <BookOpenIcon />
              Explorar apuntes
            </Link>
          </div>
        ) : (
          /* ── Grid de cards ── */
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((purchase) => {
              const resume = purchase.resumes;
              const hasReview = (purchase.reviews?.length ?? 0) > 0;

              return (
                <div
                  key={purchase.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
                >
                  {/* Imagen / placeholder */}
                  <div className="relative h-44 w-full shrink-0 overflow-hidden bg-gray-100">
                    {resume?.preview_url ? (
                      <Image
                        src={resume.preview_url}
                        alt={resume.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <DocumentIcon />
                      </div>
                    )}

                    {/* Badge comprado */}
                    <div className="absolute left-3 top-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
                        <CheckIcon />
                        Comprado
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex-1">
                      <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug text-foreground">
                        {resume?.title ?? "Sin título"}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        por {resume?.profiles?.display_name ?? "—"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {resume?.subject && (
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {resume.subject}
                          </span>
                        )}
                        {resume?.university && (
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {resume.university}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400">
                      <span>
                        {new Date(purchase.created_at).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="font-semibold text-foreground">
                        ${Number(purchase.amount).toLocaleString("es-AR")} ARS
                      </span>
                    </div>

                    {/* Acciones */}
                    <div className="mt-3 flex items-center gap-2">
                      <Link
                        href={`/my-purchases/${purchase.resume_id}/view`}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-700"
                      >
                        <BookOpenIcon />
                        Ver apunte
                      </Link>

                      {hasReview ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-400">
                          <CheckIcon />
                          Reseñado
                        </span>
                      ) : (
                        <ReviewButton
                          purchaseId={purchase.id}
                          resumeId={purchase.resume_id}
                          sellerId={purchase.seller_id}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
