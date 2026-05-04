import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PurchaseCard } from "../../purchase-card";
import type { PurchaseWithResume, FolderWithItems } from "@/lib/database.types";

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
            <Link href="/my-purchases" className="hover:text-foreground transition-colors">Mi biblioteca</Link>
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
            <p className="mt-2 max-w-sm text-sm text-gray-500">Agregá apuntes desde <Link href="/my-purchases" className="text-accent-600 hover:underline">Mi biblioteca</Link> usando el botón de carpeta en cada apunte.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {purchases.map((purchase) => (
              <PurchaseCard key={purchase.id} purchase={purchase} folders={folderList} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
