import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { BundleBuyButton } from "./bundle-buy-button";
import { sumResumePrices, bundleSavings, bundleSavingsPercent } from "@/lib/bundles/pricing";

export default async function BundlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: bundle } = await supabase
    .from("bundles")
    .select(
      `id, title, description, subject, price, seller_id, is_published, deleted_at,
       profiles!seller_id(display_name),
       bundle_items(resumes(id, title, subject, price, status, deleted_at))`
    )
    .eq("id", id)
    .single();

  if (!bundle || !bundle.is_published || bundle.deleted_at) {
    notFound();
  }

  const seller = (bundle as Record<string, unknown>).profiles as {
    display_name: string | null;
  } | null;

  type ResumeItem = {
    id: string;
    title: string;
    subject: string;
    price: number;
    status: string;
    deleted_at: string | null;
  };
  // El embed de Supabase puede tipar la relación to-one como objeto o como array;
  // normalizamos ambos casos.
  const items = ((bundle.bundle_items ?? []) as unknown as { resumes: ResumeItem | ResumeItem[] | null }[])
    .map((i) => (Array.isArray(i.resumes) ? i.resumes[0] : i.resumes))
    .filter(
      (r): r is ResumeItem => !!r && r.status === "published" && !r.deleted_at
    );

  const individualTotal = sumResumePrices(items.map((r) => Number(r.price)));
  const price = Number(bundle.price);
  const savings = bundleSavings(price, individualTotal);
  const savingsPct = bundleSavingsPercent(price, individualTotal);

  const isOwner = user?.id === bundle.seller_id;

  // ¿El vendedor tiene Mercado Pago? ¿Ya está en el carrito?
  const [{ data: mp }, { data: inCartRow }] = await Promise.all([
    supabase.from("seller_mp_credentials").select("id").eq("id", bundle.seller_id).maybeSingle(),
    user
      ? supabase
          .from("cart_items")
          .select("id")
          .eq("buyer_id", user.id)
          .eq("bundle_id", bundle.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const sellerHasMp = !!mp;
  const inCart = !!inCartRow;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <nav className="mb-6 text-sm text-gray-400">
        <Link href="/explorar" className="hover:text-gray-600">
          Explorar
        </Link>
        <span className="mx-2">·</span>
        <span className="text-foreground">Paquete</span>
      </nav>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-100">
            Paquete{bundle.subject ? ` · ${bundle.subject}` : ""}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">{bundle.title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-sand-300/75">
            por {seller?.display_name ?? "Vendedor"}
          </p>
          {bundle.description && (
            <p className="mt-4 max-w-prose text-sm leading-6 text-gray-600 dark:text-sand-100/85">
              {bundle.description}
            </p>
          )}

          <h2 className="mt-8 text-lg font-semibold text-foreground">
            Incluye {items.length} apunte{items.length === 1 ? "" : "s"}
          </h2>
          <ul className="mt-4 divide-y divide-gray-100 dark:divide-white/10">
            {items.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/resume/${r.id}`}
                    className="truncate text-sm text-foreground hover:text-accent-700 hover:underline dark:hover:text-accent-100"
                  >
                    {r.title}
                  </Link>
                  {r.subject && (
                    <p className="text-xs text-gray-400">{r.subject}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-gray-400 line-through">
                  ${Number(r.price).toLocaleString("es-AR")}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="w-full shrink-0 lg:w-80">
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="text-2xl font-bold text-accent-700 dark:text-accent-100">
              ${price.toLocaleString("es-AR")}{" "}
              <span className="text-sm font-normal text-gray-400">ARS</span>
            </div>
            {savings > 0 && (
              <p className="mt-1 text-xs font-medium text-green-700 dark:text-green-300">
                Ahorrás ${savings.toLocaleString("es-AR")}
                {savingsPct > 0 ? ` (${savingsPct}%)` : ""} vs. comprarlos por separado
              </p>
            )}

            {isOwner ? (
              <div className="mt-4 rounded-xl bg-gray-100 px-4 py-3 text-center text-xs text-gray-500 dark:bg-white/[0.04]">
                Este es tu paquete.
              </div>
            ) : !sellerHasMp ? (
              <div className="mt-4 rounded-xl bg-amber-50/60 px-4 py-3 text-xs text-amber-700">
                Este paquete no está disponible para compra aún.
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                <BundleBuyButton
                  bundleId={bundle.id}
                  sellerId={bundle.seller_id}
                  isLoggedIn={!!user}
                />
                <AddToCartButton
                  itemType="bundle"
                  itemId={bundle.id}
                  isLoggedIn={!!user}
                  initiallyInCart={inCart}
                  redirectPath={`/bundles/${bundle.id}`}
                />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
