import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ resumeId: string }> }
) {
  const { resumeId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // RLS filtra automáticamente: solo seller del apunte o buyer con compra completada
  const { data: job, error } = await supabase
    .from("ingestion_jobs")
    .select("id, status, chunks_generated, error_message, started_at, finished_at, created_at")
    .eq("resume_id", resumeId)
    .single();

  if (error || !job) {
    return NextResponse.json(
      { error: "Job no encontrado o sin permisos" },
      { status: 404 }
    );
  }

  return NextResponse.json(job);
}
