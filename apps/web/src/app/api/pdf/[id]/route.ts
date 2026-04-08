import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Proxy del PDF — fetcha server-side desde Supabase Storage y hace streaming al cliente.
// Esto evita el problema de CORS: el browser fetcha /api/pdf/{id} (mismo origen)
// en vez de la signed URL de Supabase (cross-origin a xxxx.supabase.co).
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  // Validar compra y obtener el path del archivo vía RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_resume_download_url",
    { p_resume_id: params.id }
  );

  if (rpcError || !rpcData) {
    return new NextResponse("Acceso denegado o resumen no encontrado", { status: 403 });
  }

  const filePath = (rpcData as { file_url: string; resume_id: string }).file_url;

  // Generar signed URL con TTL corto — solo se usa server-side, no se expone al cliente
  const { data: signedData, error: signedError } = await supabase.storage
    .from("resumes")
    .createSignedUrl(filePath, 60);

  if (signedError || !signedData?.signedUrl) {
    return new NextResponse("Error al generar URL de descarga", { status: 500 });
  }

  // Fetch server-side del PDF y streaming al cliente
  let pdfResponse: Response;
  try {
    pdfResponse = await fetch(signedData.signedUrl);
  } catch {
    return new NextResponse("Error al obtener el archivo", { status: 502 });
  }

  if (!pdfResponse.ok) {
    const status = pdfResponse.status === 404 ? 404 : 502;
    return new NextResponse("Archivo no encontrado o URL expirada", { status });
  }

  return new Response(pdfResponse.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
