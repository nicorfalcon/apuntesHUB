import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { ReviewButton } from "../../review-button";
import { AddToFolderMenu } from "../../add-to-folder-menu";
import type { PurchaseWithResume, FolderWithItems } from "@/lib/database.types";

function BookOpenIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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

function CheckIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

export default async function FolderPage({ params }: { params: { folderId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/my-purchases");

  // Fetch la carpeta con sus items
  const { data: folder } = await supabase
    .from("folders")
    .select("*")
    .eq("id", params.folderId)
    .eq("user_id", user.id)
    .single();

  if (!folder) redirect("/my-purchases");

  // Fetch los resume_ids en esta carpeta
  const { data: folderItems } = await supabase
    .from("folder_items")
    .select("resume_id")
    .eq("folder_id", params.folderId);

  const resumeIds = folderItems?.map((fi) => fi.resume_id) ?? [];

  // Fetch todas las carpetas del usuario (para el AddToFolderMenu)
  const { data: allFolders } = await supabase
    .from("folders")
    .select("*, folder_items(resume_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch purchases que corresponden a los apuntes de esta carpeta
  let purchases: PurchaseWithResume[] = [];
  if (resumeIds.length > 0) {
    const { data } = await supabase
      .from("purchases")
      .select("*, resumes(title, subject, university, preview_url, profiles!seller_id(display_name)), reviews(id)")
      .eq("buyer_id", user.id)
      .eq("status", "completed")
      .in("resume_id", resumeIds);
    purchases = (data as PurchaseWithResume[]) ?? [];
  }

  const folderList = (allFolders as FolderWithItems[]) ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8">
          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-2 text-sm text-gray-500">
            <Link href="/my-purchases" className="hover:text-foreground transition-colors">Mis apuntes</Link>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-foreground font-medium">{folder.name}</span>
          </nav>

          <div className="flex items-center gap-4">
            {/* Icono carpeta */}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: folder.color + "20" }}>
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={folder.color}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v8.25A2.25 2.25 0 004.5 16.5h15a2.25 2.25 0 002.25-2.25V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{folder.name}</h1>
              <p className="mt-0.5 text-sm text-gray-500">{purchases.length} {purchases.length === 1 ? "apunte" : "apuntes"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="mx-auto max-w-5xl px-4 py-10">
        {purchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: folder.color + "15" }}>
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={folder.color}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v8.25A2.25 2.25 0 004.5 16.5h15a2.25 2.25 0 002.25-2.25V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">Esta carpeta está vacía</h2>
            <p className="mt-2 max-w-sm text-sm text-gray-500">Agregá apuntes desde <Link href="/my-purchases" className="text-accent-600 hover:underline">Mis apuntes</Link> usando el botón de carpeta en cada apunte.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {purchases.map((purchase) => {
              const resume = purchase.resumes;
              const existingReview = purchase.reviews ? { id: purchase.reviews.id } : undefined;
              return (
                <div key={purchase.id} className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
                  <div className="relative h-44 w-full shrink-0 overflow-hidden bg-gray-50">
                    {resume?.preview_url ? (
                      <Image src={resume.preview_url} alt={resume.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><DocumentIcon /></div>
                    )}
                    <div className="absolute left-3 top-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
                        <CheckIcon />Comprado
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex-1">
                      <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">{resume?.title ?? "Sin título"}</h3>
                      <p className="mt-1 text-sm text-gray-500">por {resume?.profiles?.display_name ?? "—"}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {resume?.subject && <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{resume.subject}</span>}
                        {resume?.university && <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{resume.university}</span>}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400">
                      <span>{new Date(purchase.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span className="font-semibold text-foreground">${Number(purchase.amount).toLocaleString("es-AR")} ARS</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Link href={`/my-purchases/${purchase.resume_id}/view`} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-700">
                        <BookOpenIcon />Ver apunte
                      </Link>
                      <ReviewButton
                        purchaseId={purchase.id}
                        resumeId={purchase.resume_id}
                        sellerId={purchase.seller_id}
                        existingReview={existingReview}
                      />
                      <AddToFolderMenu resumeId={purchase.resume_id} folders={folderList} />
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
