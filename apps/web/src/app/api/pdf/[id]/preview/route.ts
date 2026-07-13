import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// La ruta no usa cookies ni lee el request, así que Next la trataría como estática y
// hornearía la respuesta (y las lecturas a la base) en build time. El estado de la
// preview cambia cuando el worker la procesa: siempre hay que resolverla en vivo.
export const dynamic = "force-dynamic";

const PREVIEWS_BUCKET = "resume-previews";

// 1 hora. Antes eran 120s, y las imágenes se rompían solas: el navegador vuelve a pedir
// la imagen (scroll, bfcache al volver atrás, pestaña en segundo plano) mucho después
// del fetch inicial, la firma ya había vencido y el visor caía al placeholder gris.
// Debe ser holgadamente mayor que el max-age de esta respuesta (ver abajo): si no, una
// respuesta servida desde caché puede traer URLs ya muertas.
const SIGNED_URL_TTL_SECONDS = 3600;

// Cuánto puede cachear el browser esta respuesta. Muy por debajo del TTL de las firmas
// para que ninguna URL cacheada llegue vencida al <img>.
const CACHE_MAX_AGE_SECONDS = 60;

/**
 * GET /api/pdf/[id]/preview
 * Devuelve las imágenes de la vista previa protegida (estilo Scribd) de un apunte
 * PUBLICADO. No requiere compra ni sesión: es el "hojeá antes de comprar".
 *
 * Las páginas libres vienen nítidas; las bloqueadas en baja resolución (el visor
 * refuerza con blur). Las imágenes viven en un bucket privado y se sirven con
 * signed URLs de TTL corto generadas con el service role tras validar que el
 * apunte esté publicado.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = createAdminClient();

  // 1. El apunte debe existir y estar publicado. Usamos service role pero
  //    validamos el estado explícitamente (no confiamos en RLS acá).
  const { data: resume, error: resumeError } = await admin
    .from("resumes")
    .select("id, status, deleted_at, preview_status, preview_page_count")
    .eq("id", params.id)
    .maybeSingle();

  // Debe estar publicado Y no borrado (soft-delete): un apunte que el vendedor quitó
  // del marketplace conserva status='published' y solo marca deleted_at. Sin este
  // filtro serviríamos su vista previa (con páginas nítidas legibles). Misma
  // convención que la RLS pública de resumes (0008).
  if (
    resumeError ||
    !resume ||
    resume.status !== "published" ||
    resume.deleted_at !== null
  ) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // 2. Si la preview todavía no está lista, informamos el estado y una lista vacía.
  if (resume.preview_status !== "ready") {
    return NextResponse.json(
      { status: resume.preview_status, pageCount: 0, pages: [] },
      { headers: { "Cache-Control": "private, max-age=15" } }
    );
  }

  // 3. Leer las páginas y firmar cada imagen.
  const { data: pages, error: pagesError } = await admin
    .from("resume_preview_pages")
    .select("page_number, storage_path, is_locked, width, height")
    .eq("resume_id", params.id)
    .order("page_number", { ascending: true });

  if (pagesError || !pages || pages.length === 0) {
    return NextResponse.json(
      { status: "ready", pageCount: 0, pages: [] },
      { headers: { "Cache-Control": "private, max-age=15" } }
    );
  }

  const paths = pages.map((p) => p.storage_path);
  const { data: signed, error: signError } = await admin.storage
    .from(PREVIEWS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) {
    return NextResponse.json(
      { error: "No se pudieron generar las imágenes" },
      { status: 500 }
    );
  }

  const urlByPath = new Map(
    signed.map((s) => [s.path ?? "", s.signedUrl])
  );

  const result = pages.map((p) => ({
    page: p.page_number,
    url: urlByPath.get(p.storage_path) ?? null,
    locked: p.is_locked,
    w: p.width,
    h: p.height,
  }));

  return NextResponse.json(
    {
      status: "ready",
      pageCount: resume.preview_page_count ?? result.length,
      pages: result,
    },
    {
      headers: {
        "Cache-Control": `private, max-age=${CACHE_MAX_AGE_SECONDS}`,
      },
    }
  );
}
