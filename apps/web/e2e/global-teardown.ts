import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./support/env";
import {
  E2E_BUYER,
  E2E_SELLER,
  E2E_RESUME_ID,
  E2E_UNPURCHASED_RESUME_ID,
  E2E_PURCHASE_ID,
  E2E_SUBJECT_ID,
  E2E_COURSE_ID,
  E2E_MODULE_ID,
  E2E_UNENROLLED_COURSE_ID,
  E2E_UNENROLLED_MODULE_ID,
  E2E_ENROLLMENT_ID,
  E2E_TUTOR_SUBJECT_ID,
  E2E_TUTOR_AVAILABILITY_ID,
  E2E_TUTOR_BOOKING_ID,
  E2E_MATERIAL_QUESTION_ID,
} from "./support/seed";

/**
 * GlobalTeardown: corre UNA vez al final de toda la suite E2E (pase o falle).
 *
 * Importante por el contexto del proyecto: usamos una sola base Supabase
 * (la misma de producción, por alcance de la materia). El seed deja fixtures
 * publicados (apuntes, cursos, oferta de tutor) que quedarían visibles en el
 * catálogo real. Este teardown los borra al terminar, scopeado SOLO a los IDs
 * y usuarios de test (UUIDs fijos + emails @e2e.local), nunca datos reales.
 *
 * Cada borrado es tolerante a errores: si algo falla, registra una advertencia
 * pero no rompe la corrida (no queremos que un problema de limpieza marque la
 * suite como fallida).
 */

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findUserId(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return null;
  return data.users.find((u) => u.email === email)?.id ?? null;
}

async function safe(
  desc: string,
  op: () => PromiseLike<{ error: { message?: string } | null }>
): Promise<void> {
  try {
    const { error } = await op();
    if (error) {
      console.warn(`[e2e/teardown] ${desc}: ${error.message ?? error}`);
    }
  } catch (err) {
    console.warn(`[e2e/teardown] ${desc} (excepción):`, err);
  }
}

async function globalTeardown(): Promise<void> {
  loadDotEnvLocal();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.warn(
      "[e2e/teardown] Faltan credenciales de Supabase. Salteo la limpieza."
    );
    return;
  }

  const admin = adminClient();
  const [buyerId, sellerId] = await Promise.all([
    findUserId(admin, E2E_BUYER.email),
    findUserId(admin, E2E_SELLER.email),
  ]);

  const courseIds = [E2E_COURSE_ID, E2E_UNENROLLED_COURSE_ID];
  const moduleIds = [E2E_MODULE_ID, E2E_UNENROLLED_MODULE_ID];
  const resumeIds = [E2E_RESUME_ID, E2E_UNPURCHASED_RESUME_ID];

  // Orden: primero los hijos (FKs), después los padres.

  // 1. Sub-recursos de la consulta de material.
  await safe("material_question_me_toos", () =>
    admin.from("material_question_me_toos").delete().eq("question_id", E2E_MATERIAL_QUESTION_ID)
  );
  await safe("material_question_followups", () =>
    admin.from("material_question_followups").delete().eq("question_id", E2E_MATERIAL_QUESTION_ID)
  );
  await safe("material_question_answers", () =>
    admin.from("material_question_answers").delete().eq("question_id", E2E_MATERIAL_QUESTION_ID)
  );
  await safe("material_questions", () =>
    admin.from("material_questions").delete().eq("id", E2E_MATERIAL_QUESTION_ID)
  );

  // 2. Cursos: progreso, inscripción, assets de video, módulos, cursos.
  await safe("course_progress", () =>
    admin.from("course_progress").delete().eq("enrollment_id", E2E_ENROLLMENT_ID)
  );
  await safe("course_enrollments", () =>
    admin.from("course_enrollments").delete().eq("id", E2E_ENROLLMENT_ID)
  );
  await safe("course_video_assets", () =>
    admin.from("course_video_assets").delete().in("module_id", moduleIds)
  );
  await safe("course_modules", () =>
    admin.from("course_modules").delete().in("id", moduleIds)
  );
  await safe("recorded_courses", () =>
    admin.from("recorded_courses").delete().in("id", courseIds)
  );

  // 3. Tutorías: mensajes, booking, disponibilidad, materia.
  await safe("tutor_messages", () =>
    admin.from("tutor_messages").delete().eq("booking_id", E2E_TUTOR_BOOKING_ID)
  );
  await safe("tutor_bookings", () =>
    admin.from("tutor_bookings").delete().eq("id", E2E_TUTOR_BOOKING_ID)
  );
  await safe("tutor_availability", () =>
    admin.from("tutor_availability").delete().eq("id", E2E_TUTOR_AVAILABILITY_ID)
  );
  await safe("tutor_subjects", () =>
    admin.from("tutor_subjects").delete().eq("id", E2E_TUTOR_SUBJECT_ID)
  );

  // 4. Apuntes: compra y resumes.
  await safe("purchases", () =>
    admin.from("purchases").delete().eq("id", E2E_PURCHASE_ID)
  );
  await safe("resumes", () =>
    admin.from("resumes").delete().in("id", resumeIds)
  );

  // 5. Materia compartida.
  await safe("subjects", () =>
    admin.from("subjects").delete().eq("id", E2E_SUBJECT_ID)
  );

  // 6. Datos por-usuario de test.
  if (sellerId) {
    await safe("seller_mp_credentials", () =>
      admin.from("seller_mp_credentials").delete().eq("id", sellerId)
    );
    // El seller queda marcado como tutor por el seed; lo revertimos para que no
    // aparezca como profesor en el catálogo real.
    await safe("profiles.is_tutor=false", () =>
      admin.from("profiles").update({ is_tutor: false }).eq("id", sellerId)
    );
  }

  const userIds = [buyerId, sellerId].filter((id): id is string => Boolean(id));
  if (userIds.length > 0) {
    await safe("user_devices", () =>
      admin.from("user_devices").delete().in("user_id", userIds)
    );
  }

  console.log("[e2e/teardown] Limpieza de fixtures E2E completada.");
}

export default globalTeardown;
