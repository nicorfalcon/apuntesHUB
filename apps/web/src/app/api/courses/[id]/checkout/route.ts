import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/mercadopago/refresh-token";

/**
 * POST /api/courses/[id]/checkout
 * Crea (o reutiliza) un enrollment pendiente y devuelve la preferencia
 * de Mercado Pago para que el alumno complete el pago.
 * Reusa el patrón de /api/mercadopago/create-preference.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!courseId) {
    return NextResponse.json({ error: "courseId es requerido" }, { status: 400 });
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("enroll_course", {
    p_course_id: courseId,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  const { enrollment_id: enrollmentId, free } = rpcData as {
    enrollment_id: string;
    status: string;
    free?: boolean;
  };

  // Curso gratis (precio 0 o -100%): la RPC ya completó la inscripción. Mercado Pago
  // rechaza una preferencia con unit_price 0, así que no hay pasarela que crear.
  if (free) {
    return NextResponse.json({
      free: true,
      enrollmentId,
      redirectUrl: `/cursos/${courseId}`,
    });
  }

  const admin = createAdminClient();
  const { data: enrollment } = await admin
    .from("course_enrollments")
    .select(
      "id, amount, platform_fee, course_id, recorded_courses!inner(id, title, author_id)"
    )
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) {
    return NextResponse.json(
      { error: "Inscripción no encontrada" },
      { status: 404 }
    );
  }

  const course = (enrollment as Record<string, unknown>).recorded_courses as {
    id: string;
    title: string;
    author_id: string;
  } | null;

  if (!course) {
    return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(course.author_id);
  } catch (err) {
    console.error("Error al obtener token del autor:", err);
    return NextResponse.json(
      { error: "El autor no tiene Mercado Pago configurado correctamente" },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const client = new MercadoPagoConfig({ accessToken });
  const preference = new Preference(client);

  // Prefijo para que el webhook detecte que es un enrollment, no una purchase de apunte.
  const externalReference = `course_enrollment:${enrollmentId}`;

  try {
    const mpPreference = await preference.create({
      body: {
        items: [
          {
            id: courseId,
            title: course.title ?? "Curso grabado",
            quantity: 1,
            unit_price: Number(enrollment.amount),
            currency_id: "ARS",
          },
        ],
        back_urls: {
          success: `${appUrl}/checkout/curso/success?enrollment_id=${enrollmentId}`,
          failure: `${appUrl}/checkout/curso/failure?enrollment_id=${enrollmentId}`,
          pending: `${appUrl}/checkout/curso/pending?enrollment_id=${enrollmentId}`,
        },
        auto_return: "approved",
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
        external_reference: externalReference,
        marketplace_fee: Number(enrollment.platform_fee),
      },
    });

    await admin
      .from("course_enrollments")
      .update({ mp_preference_id: mpPreference.id })
      .eq("id", enrollmentId);

    return NextResponse.json({
      enrollmentId,
      preferenceId: mpPreference.id,
      initPoint: mpPreference.init_point,
    });
  } catch (err) {
    console.error("Error al crear preferencia MP del curso:", err);
    const errorDetail = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json(
      { error: "Error al crear la preferencia de pago", detail: errorDetail },
      { status: 500 }
    );
  }
}
