import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { bucket, path } = (await request.json()) as {
    bucket?: string;
    path?: string;
  };

  if (!bucket || !path) {
    return NextResponse.json(
      { error: "Faltan campos: bucket, path" },
      { status: 400 }
    );
  }

  if (!path.startsWith(user.id + "/")) {
    return NextResponse.json(
      { error: "No tenés permiso para subir a esta ruta" },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUploadUrl(path, { upsert: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let publicUrl: string | null = null;
  if (bucket === "previews") {
    const { data: urlData } = admin.storage.from(bucket).getPublicUrl(path);
    publicUrl = urlData.publicUrl;
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl,
  });
}
