import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/mercadopago/refresh-token";

/**
 * POST /api/mercadopago/create-tutoring-preference
 *
 * Flujo:
 *   1. Alumno autenticado envía { tutor_id, subject_id, scheduled_at, duration_minutes, modality }
 *   2. Se llama la RPC create_tutoring_booking (valida todo server-side, calcula precio)
 *   3. Se obtiene el access_token del tutor vía OAuth
 *   4. Se crea la preferencia de Checkout Pro en MercadoPago
 *   5. Se guarda mp_preference_id en el booking
 *   6. Se retorna initPoint para redirección
 *
 * El precio NUNCA viene del frontend. Se calcula en la RPC desde tutor_subjects.hourly_rate_ars.
 */

interface TutoringPreferenceBody {
  tutor_id: string;
  subject_id: string;
  scheduled_at: string; // ISO datetime
  duration_minutes: number;
  modality: string;
  initial_message?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: TutoringPreferenceBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const {
    tutor_id,
    subject_id,
    scheduled_at,
    duration_minutes,
    modality,
    initial_message,
  } = body;

  if (!tutor_id || !subject_id || !scheduled_at || !duration_minutes || !modality) {
    return NextResponse.json(
      { error: "Faltan campos requeridos" },
      { status: 400 }
    );
  }

  // ── 1. Crear booking vía RPC (valida todo, calcula precio, previene overbooking) ──
  const { data: bookingData, error: bookingError } = await supabase.rpc(
    "create_tutoring_booking",
    {
      p_tutor_id: tutor_id,
      p_subject_id: subject_id,
      p_scheduled_at: scheduled_at,
      p_duration_minutes: duration_minutes,
      p_modality: modality,
      p_initial_message: initial_message ?? null,
    }
  );

  if (bookingError) {
    return NextResponse.json(
      { error: bookingError.message },
      { status: 400 }
    );
  }

  const {
    booking_id: bookingId,
    amount,
    platform_fee: platformFee,
  } = bookingData as {
    booking_id: string;
    amount: number;
    platform_fee: number;
    seller_amount: number;
    status: string;
    payment_expires_at: string;
  };

  // ── 2. Obtener datos para la preferencia ──
  const admin = createAdminClient();

  // Nombre de la materia para el título
  const { data: subjectData } = await admin
    .from("tutor_subjects")
    .select("subjects(name)")
    .eq("tutor_id", tutor_id)
    .eq("subject_id", subject_id)
    .single();

  const subjectName =
    (subjectData as Record<string, unknown>)?.subjects as
      | { name: string }
      | null;
  const itemTitle = `Clase particular: ${subjectName?.name ?? "Materia"} (${duration_minutes} min)`;

  // ── 3. Obtener access_token del tutor ──
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(tutor_id);
  } catch (err) {
    console.error("Error al obtener token del tutor:", err);
    // Revertir el booking ya que no se puede procesar el pago
    await admin
      .from("tutor_bookings")
      .update({ status: "failed" })
      .eq("id", bookingId);
    return NextResponse.json(
      { error: "El profesor no tiene Mercado Pago configurado correctamente" },
      { status: 400 }
    );
  }

  // ── 4. Crear preferencia de Checkout Pro ──
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const client = new MercadoPagoConfig({ accessToken });
  const preference = new Preference(client);

  const externalReference = `tutoring_booking:${bookingId}`;

  try {
    const mpPreference = await preference.create({
      body: {
        items: [
          {
            id: bookingId,
            title: itemTitle,
            quantity: 1,
            unit_price: Number(amount),
            currency_id: "ARS",
          },
        ],
        back_urls: {
          success: `${appUrl}/checkout/clase/success?booking_id=${bookingId}`,
          failure: `${appUrl}/checkout/clase/failure?booking_id=${bookingId}`,
          pending: `${appUrl}/checkout/clase/pending?booking_id=${bookingId}`,
        },
        auto_return: "approved",
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
        external_reference: externalReference,
        marketplace_fee: Number(platformFee),
        // Expiración de la preferencia: 10 minutos (igual que payment_expires_at)
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(
          Date.now() + 10 * 60_000
        ).toISOString(),
      },
    });

    // ── 5. Guardar preference ID en el booking ──
    await admin
      .from("tutor_bookings")
      .update({ mp_preference_id: mpPreference.id })
      .eq("id", bookingId);

    return NextResponse.json({
      bookingId,
      preferenceId: mpPreference.id,
      initPoint: mpPreference.init_point,
      amount,
      expiresAt: bookingData.payment_expires_at,
    });
  } catch (err) {
    console.error("Error al crear preferencia MP de tutoría:", err);
    // Marcar el booking como fallido si no se pudo crear la preferencia
    await admin
      .from("tutor_bookings")
      .update({ status: "failed" })
      .eq("id", bookingId);
    const errorDetail =
      err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json(
      { error: "Error al crear la preferencia de pago", detail: errorDetail },
      { status: 500 }
    );
  }
}
