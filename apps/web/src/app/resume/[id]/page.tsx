import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { StarRating } from "@/components/ui/star-rating";
import { ResumeTopicsSection } from "@/components/resume/resume-topics";
import { PurchaseButton } from "./purchase-button";
import { PreviewViewer } from "./preview-viewer";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { discountedPrice, hasDiscount } from "@/lib/discounts/direct";
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
  if ((resume as { deleted_at?: string | null }).deleted_at && user?.id !== (resume as { seller_id: string }).seller_id) {
    notFound();
  }

  const resumeWithSeller = resume as ResumeWithSeller;
  const { profiles: seller } = resumeWithSeller;
  const effectivePrice = discountedPrice(
    resumeWithSeller.price,
    resumeWithSeller.discount_percent
  );
  const isFree = effectivePrice === 0;

  // Verificar si el usuario ya compró o tiene compra pendiente
  let alreadyPurchased = false;
  let hasPendingPurchase = false;
  if (user) {
    const { data: purchases } = await supabase
      .from("purchases")
      .select("id, status")
      .eq("buyer_id", user.id)
      .eq("resume_id", id)
      .in("status", ["completed", "pending"]);

    alreadyPurchased = purchases?.some((p) => p.status === "completed") ?? false;
    hasPendingPurchase = purchases?.some((p) => p.status === "pending") ?? false;
  }

  // Verificar si el vendedor tiene MP conectado (via admin para bypasear RLS)
  const admin = createAdminClient();
  const { data: mpCreds } = await admin
    .from("seller_mp_credentials")
    .select("id")
    .eq("id", resumeWithSeller.seller_id)
    .single();
  const sellerHasMp = !!mpCreds;

  // Paquetes publicados que incluyen este apunte (descubrimiento) + estado de carrito.
  const { data: bundleLinks } = await supabase
    .from("bundle_items")
    .select("bundles!inner(id, title, price, is_published, deleted_at)")
    .eq("resume_id", id);
  type RelatedBundle = { id: string; title: string; price: number };
  const relatedBundles = ((bundleLinks ?? []) as unknown as {
    bundles: { id: string; title: string; price: number; is_published: boolean; deleted_at: string | null } | null;
  }[])
    .map((r) => r.bundles)
    .filter((b): b is NonNullable<typeof b> => !!b && b.is_published && !b.deleted_at)
    .map((b): RelatedBundle => ({ id: b.id, title: b.title, price: Number(b.price) }));

  let resumeInCart = false;
  if (user) {
    const { data: cartRow } = await supabase
      .from("cart_items")
      .select("id")
      .eq("buyer_id", user.id)
      .eq("resume_id", id)
      .maybeSingle();
    resumeInCart = !!cartRow;
  }

  // Reviews de este resumen
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*, profiles!reviewer_id(display_name)")
    .eq("resume_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const [{ count: privateQuestionCount }, { count: answeredQuestionCount }] =
    await Promise.all([
      admin
        .from("material_questions")
        .select("*", { count: "exact", head: true })
        .eq("target_type", "resume")
        .eq("resume_id", id)
        .neq("status", "hidden"),
      admin
        .from("material_questions")
        .select("*", { count: "exact", head: true })
        .eq("target_type", "resume")
        .eq("resume_id", id)
        .in("status", ["answered", "resolved"]),
    ]);

  const isOwnResume = user?.id === resumeWithSeller.seller_id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-gray-400">
        <Link href="/" className="hover:text-gray-600">Inicio</Link>
        <span className="mx-2">·</span>
        <Link href="/explorar" className="hover:text-gray-600">Explorar</Link>
        <span className="mx-2">·</span>
        <span className="text-foreground">{resumeWithSeller.title}</span>
      </nav>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Contenido principal */}
        <div className="flex-1 space-y-8">
          {/* Preview */}
          {resumeWithSeller.preview_url ? (
            <div className="relative h-80 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-white/10 dark:bg-white/[0.04]">
              <Image
                src={resumeWithSeller.preview_url}
                alt={`Preview de ${resumeWithSeller.title}`}
                fill
                className="object-contain"
              />
            </div>
          ) : (
            <div className="flex h-48 w-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 dark:border-white/15 dark:bg-white/[0.03]">
              <p className="text-sm text-gray-400">Sin preview disponible</p>
            </div>
          )}

          {/* Vista previa protegida (estilo Scribd): páginas libres nítidas +
              bloqueadas con blur. El dueño y quien ya compró la ven sin candados. */}
          <PreviewViewer
            resumeId={resumeWithSeller.id}
            unlocked={isOwnResume || alreadyPurchased}
          />

          <ResumeTopicsSection
            topics={resumeWithSeller.topics}
            className="rounded-xl border border-gray-100 bg-gray-50/70 p-5 dark:border-white/10 dark:bg-white/[0.03]"
          />

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
                    <div key={r.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{r.profiles.display_name}</span>
                        <StarRating rating={r.rating} />
                      </div>
                      {r.comment && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-sand-100/85">{r.comment}</p>
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
        <aside id="comprar" className="w-full shrink-0 scroll-mt-24 lg:w-80">
          <div className="sticky top-20 space-y-5 rounded-xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#0f1e1a]">
            <div>
              <h1 className="text-xl font-bold text-foreground leading-tight">
                {resumeWithSeller.title}
              </h1>
              {resumeWithSeller.description && (
                <p className="mt-2 text-sm text-gray-500 dark:text-sand-300/75">{resumeWithSeller.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-100 text-xs font-semibold text-accent-700 dark:bg-accent-300/15 dark:text-accent-100">
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
                    rating={resumeWithSeller.rating_avg ?? 0}
                    count={resumeWithSeller.rating_count ?? 0}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-gray-100 pt-4 text-sm dark:border-white/10">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-sand-300/75">Universidad</span>
                <span className="font-medium">{resumeWithSeller.university}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-sand-300/75">Carrera</span>
                <span className="font-medium">{resumeWithSeller.career}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-sand-300/75">Materia</span>
                <span className="font-medium">{resumeWithSeller.subject}</span>
              </div>
            </div>

            {((privateQuestionCount ?? 0) > 0 || (answeredQuestionCount ?? 0) > 0) && (
              <div className="space-y-2 border-t border-gray-100 pt-4 text-sm dark:border-white/10">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 dark:text-sand-300/75">Consultas privadas</span>
                  <span className="text-right font-medium">
                    Incluye {privateQuestionCount ?? 0}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 dark:text-sand-300/75">Respondidas</span>
                  <span className="text-right font-medium">
                    {answeredQuestionCount ?? 0} por el autor
                  </span>
                </div>
              </div>
            )}

            <div className="border-t border-gray-100 pt-4 dark:border-white/10">
              {hasDiscount(resumeWithSeller.discount_percent) ? (
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
                    -{resumeWithSeller.discount_percent}%
                  </span>
                  <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                    $
                    {discountedPrice(
                      resumeWithSeller.price,
                      resumeWithSeller.discount_percent
                    ).toLocaleString("es-AR")}{" "}
                    <span className="text-sm font-normal text-gray-400 dark:text-sand-300/60">
                      ARS
                    </span>
                  </div>
                  <span className="text-base font-medium text-gray-400 line-through">
                    ${resumeWithSeller.price.toLocaleString("es-AR")}
                  </span>
                </div>
              ) : isFree ? (
                <div className="text-2xl font-bold text-accent-700 dark:text-accent-100">
                  Gratis
                </div>
              ) : (
                <div className="text-2xl font-bold text-accent-700 dark:text-accent-100">
                  ${resumeWithSeller.price.toLocaleString("es-AR")}{" "}
                  <span className="text-sm font-normal text-gray-400 dark:text-sand-300/60">ARS</span>
                </div>
              )}

              {isOwnResume ? (
                <Link
                  href={`/sell/${resumeWithSeller.id}/edit`}
                  className="mt-4 flex w-full items-center justify-center rounded-lg border border-accent-600 py-2.5 text-sm font-semibold text-accent-600 transition-colors hover:bg-accent-50 dark:border-accent-300/35 dark:text-accent-100 dark:hover:bg-accent-300/10"
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
                  Ya comprado: ver mi biblioteca
                </Link>
              ) : (
                <>
                  <PurchaseButton
                    resumeId={resumeWithSeller.id}
                    isLoggedIn={!!user}
                    sellerHasMp={sellerHasMp}
                    hasPendingPurchase={hasPendingPurchase}
                    isFree={isFree}
                  />
                  {/* El carrito sigue disponible aunque haya una compra pendiente: si el
                      comprador arrancó el pago individual y se arrepintió, no queda
                      obligado a pagarlo suelto. */}
                  {(sellerHasMp || isFree) && !isOwnResume && (
                    <div className="mt-2.5">
                      <AddToCartButton
                        itemType="resume"
                        itemId={resumeWithSeller.id}
                        isLoggedIn={!!user}
                        initiallyInCart={resumeInCart}
                        redirectPath={`/resume/${resumeWithSeller.id}`}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {relatedBundles.length > 0 && !alreadyPurchased && (
              <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-xs font-semibold text-foreground">
                  Parte de {relatedBundles.length === 1 ? "un paquete" : "estos paquetes"}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {relatedBundles.map((b) => (
                    <li key={b.id}>
                      <Link
                        href={`/bundles/${b.id}`}
                        className="flex items-center justify-between gap-2 text-xs text-accent-700 hover:underline dark:text-accent-100"
                      >
                        <span className="truncate">{b.title}</span>
                        <span className="shrink-0 text-gray-400">
                          ${b.price.toLocaleString("es-AR")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
