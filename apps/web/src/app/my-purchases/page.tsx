import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateFolderButton } from "./create-folder-button";
import { FolderCard } from "./folder-card";
import { PurchaseCard } from "./purchase-card";
import type { PurchaseWithResume, FolderWithItems } from "@/lib/database.types";
import Link from "next/link";

export default async function MisApuntesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/my-purchases");

  const [{ data: purchases }, { data: folders }] = await Promise.all([
    supabase
      .from("purchases")
      .select("*, resumes(title, subject, university, preview_url, profiles!seller_id(display_name)), reviews(id)")
      .eq("buyer_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false }),
    supabase
      .from("folders")
      .select("*, folder_items(resume_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const list = (purchases as PurchaseWithResume[]) ?? [];
  const folderList = (folders as FolderWithItems[]) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Mis apuntes</h1>
          <p className="mt-1.5 text-sm text-gray-500">Accedé y organizá todos los apuntes que compraste.</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 space-y-12">
        {/* Sección carpetas */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Mis carpetas</h2>
            <CreateFolderButton />
          </div>
          {folderList.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">Creá carpetas para organizar tus apuntes por materia o tema.</p>
              <CreateFolderButton variant="ghost" className="mt-3" />
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {folderList.map((folder) => (
                <FolderCard key={folder.id} folder={folder} />
              ))}
            </div>
          )}
        </section>

        {/* Sección apuntes */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Todos mis apuntes</h2>
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="h-16 w-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />
              </svg>
              <h3 className="mt-4 text-lg font-semibold text-foreground">Todavía no compraste ningún apunte</h3>
              <p className="mt-2 max-w-sm text-sm text-gray-500">Explorá el marketplace y encontrá el material que necesitás para tus materias.</p>
              <Link href="/browse" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700">
                Explorar apuntes
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((purchase) => (
                <PurchaseCard key={purchase.id} purchase={purchase} folders={folderList} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
