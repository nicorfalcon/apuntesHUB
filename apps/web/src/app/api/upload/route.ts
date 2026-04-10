import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // 1. Verificar que el usuario está autenticado
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // 2. Leer el archivo del FormData
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const bucket = formData.get("bucket") as string | null;
  const path = formData.get("path") as string | null;

  if (!file || !bucket || !path) {
    return NextResponse.json(
      { error: "Faltan campos: file, bucket, path" },
      { status: 400 }
    );
  }

  // 3. Verificar que el path empiece con el userId del usuario autenticado
  if (!path.startsWith(user.id + "/")) {
    return NextResponse.json(
      { error: "No tenés permiso para subir a esta ruta" },
      { status: 403 }
    );
  }

  // 4. Subir usando el admin client (bypassa RLS)
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .upload(path, file, { upsert: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 5. Si es el bucket previews, devolver la URL pública
  let publicUrl: string | null = null;
  if (bucket === "previews") {
    const { data: urlData } = admin.storage.from(bucket).getPublicUrl(path);
    publicUrl = urlData.publicUrl;
  }

  return NextResponse.json({ path: data.path, publicUrl });
}
