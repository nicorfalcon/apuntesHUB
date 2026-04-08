import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PdfViewer } from "@/components/ui/pdf-viewer";

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

  // Validar que el usuario tiene una compra completada para este resume.
  // La signed URL y el streaming del PDF los maneja /api/pdf/[id] server-side,
  // evitando CORS al no exponer URLs de Supabase al browser.
  const { error: rpcError } = await supabase.rpc("get_resume_download_url", {
    p_resume_id: params.id,
  });

  if (rpcError) {
    redirect("/my-purchases");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/my-purchases"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Volver a mis compras
        </Link>
      </div>
      <PdfViewer url={`/api/pdf/${params.id}`} userEmail={user.email ?? ""} />
    </div>
  );
}
