import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Identidades de prueba reservadas para E2E. Los emails tienen el prefijo
// `e2e-` y el dominio `@e2e.local` para que sean fácilmente identificables y
// no choquen con datos reales.
export const E2E_BUYER = {
  email: "e2e-buyer@e2e.local",
  password: "Buyer-E2E-Pass-2026!",
  fullName: "Buyer E2E",
};

export const E2E_SELLER = {
  email: "e2e-seller@e2e.local",
  password: "Seller-E2E-Pass-2026!",
  fullName: "Seller E2E",
};

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY. Verificá .env.local."
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Asegura que un usuario de test exista con la contraseña esperada y el email
 * confirmado. Idempotente: si ya existe lo actualiza en vez de fallar.
 */
async function ensureUser(
  admin: SupabaseClient,
  user: { email: string; password: string; fullName: string }
): Promise<string> {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: user.fullName },
  });

  if (created?.user) return created.user.id;

  // Si ya existe, buscarlo y actualizar la contraseña por las dudas.
  if (createErr && /already.*registered|exists/i.test(createErr.message)) {
    // listUsers no permite filtrar por email en supabase-js, así que paginamos
    // hasta encontrarlo. Con una base modesta, una sola página alcanza.
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      perPage: 1000,
    });
    if (listErr) throw listErr;
    const existing = list.users.find((u) => u.email === user.email);
    if (!existing) {
      throw new Error(`Usuario ${user.email} no se pudo crear ni encontrar.`);
    }
    await admin.auth.admin.updateUserById(existing.id, {
      password: user.password,
      email_confirm: true,
    });
    return existing.id;
  }

  throw createErr ?? new Error("createUser falló sin mensaje");
}

export interface SeededIdentities {
  buyerId: string;
  sellerId: string;
}

// IDs deterministas para los recursos sembrados (uuids fijos). Permiten que
// specs y seed compartan referencias sin lookups.
// Resume YA COMPRADO por el buyer (lo usa la biblioteca y /checkout/success).
export const E2E_RESUME_ID = "11111111-1111-1111-1111-111111111111";
// Resume SIN COMPRAR por el buyer (lo usa el spec de compra para ver el botón).
export const E2E_UNPURCHASED_RESUME_ID =
  "33333333-3333-3333-3333-333333333333";
export const E2E_PURCHASE_ID = "22222222-2222-2222-2222-222222222222";

// Datos de cursos grabados (Fase 3C).
// subjects es FK obligatoria desde recorded_courses.subject_id (NOT NULL).
export const E2E_SUBJECT_ID = "44444444-4444-4444-4444-444444444444";
// Curso YA INSCRIPTO por el buyer (aparece en biblioteca tab Cursos).
export const E2E_COURSE_ID = "55555555-5555-5555-5555-555555555555";
export const E2E_MODULE_ID = "66666666-6666-6666-6666-666666666666";
// Curso SIN INSCRIBIR (lo usa el spec de detalle para ver el botón "Inscribirme").
// Si tuviera enrollment completed, /cursos/[id] muestra "Ver curso" en su lugar.
export const E2E_UNENROLLED_COURSE_ID =
  "88888888-8888-8888-8888-888888888888";
export const E2E_UNENROLLED_MODULE_ID =
  "99999999-9999-9999-9999-999999999999";
export const E2E_ENROLLMENT_ID = "77777777-7777-7777-7777-777777777777";

// Tutorías (Fase 3D). Reusamos E2E_SUBJECT_ID como materia que el seller
// enseña: tutor_subjects.subject_id es FK a subjects.id y no importa que
// también esté atada a los cursos grabados.
export const E2E_TUTOR_SUBJECT_ID =
  "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
export const E2E_TUTOR_AVAILABILITY_ID =
  "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
export const E2E_TUTOR_BOOKING_ID =
  "cccccccc-cccc-cccc-cccc-cccccccccccc";

// Material questions (Fase 3F). Consulta del buyer sobre el resume comprado;
// la usa /sell/dashboard tab Consultas y el panel del viewer.
export const E2E_MATERIAL_QUESTION_ID =
  "dddddddd-dddd-dddd-dddd-dddddddddddd";
export const E2E_MATERIAL_QUESTION_TITLE =
  "¿Cómo interpreto este ejercicio?";
export const E2E_MATERIAL_QUESTION_BODY =
  "Pregunta sembrada para tests E2E sobre el apunte comprado.";

// Datos del resume de prueba: lo mínimo para que /resume/[id] renderice con
// el botón "Comprar apunte" habilitado.
const E2E_RESUME_TITLE = "Apunte E2E de prueba";
const E2E_RESUME_DESCRIPTION = "Resumen sembrado para tests E2E.";
const E2E_RESUME_SUBJECT = "Materia E2E";
const E2E_RESUME_UNIVERSITY = "Universidad E2E";
const E2E_RESUME_CAREER = "Carrera E2E";
const E2E_RESUME_PRICE = 1000;
const E2E_RESUME_FILE_URL = "e2e/placeholder.pdf";

/**
 * Borra los registros de `user_devices` del usuario para que el próximo login
 * no choque con MAX_DEVICES_PER_USER (cada corrida de Playwright registra un
 * dispositivo nuevo porque arranca sin device cookie). Mantener limpio el
 * estado entre corridas hace al setup idempotente.
 */
async function cleanUserDevices(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await admin
    .from("user_devices")
    .delete()
    .eq("user_id", userId);
  if (error) {
    // No es fatal: el login podría fallar después si todavía hay restos, pero
    // preferimos no romper el setup por esto.
    console.warn(
      `[e2e/seed] No se pudieron limpiar user_devices de ${userId}:`,
      error.message
    );
  }
}

/**
 * Asegura que el seller tenga credenciales de MP conectadas. Sin esto el
 * detalle del apunte muestra "El vendedor no tiene MP configurado" en lugar
 * del botón de compra. Los tokens son dummies: el spec mockea la llamada al
 * endpoint que los usaría, así que no se llegan a usar de verdad.
 */
async function ensureSellerMpCredentials(
  admin: SupabaseClient,
  sellerId: string
): Promise<void> {
  const farFuture = new Date(
    Date.now() + 365 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { error } = await admin.from("seller_mp_credentials").upsert(
    {
      id: sellerId,
      mp_access_token: "e2e-dummy-access-token",
      mp_refresh_token: "e2e-dummy-refresh-token",
      mp_public_key: "e2e-dummy-public-key",
      mp_user_id: "e2e-dummy-user-id",
      mp_token_expires_at: farFuture,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) {
    console.warn(
      "[e2e/seed] No se pudo asegurar seller_mp_credentials:",
      error.message
    );
  }
}

/**
 * Asegura que exista un resume publicado del seller. Idempotente vía upsert
 * por id determinista.
 */
async function ensureResume(
  admin: SupabaseClient,
  sellerId: string,
  id: string,
  title: string
): Promise<void> {
  const { error } = await admin.from("resumes").upsert(
    {
      id,
      seller_id: sellerId,
      title,
      description: E2E_RESUME_DESCRIPTION,
      subject: E2E_RESUME_SUBJECT,
      university: E2E_RESUME_UNIVERSITY,
      career: E2E_RESUME_CAREER,
      price: E2E_RESUME_PRICE,
      file_url: E2E_RESUME_FILE_URL,
      preview_url: null,
      status: "published",
      deleted_at: null,
    },
    { onConflict: "id" }
  );
  if (error) {
    console.warn(
      `[e2e/seed] No se pudo asegurar el resume ${id}:`,
      error.message
    );
  }
}

/**
 * Asegura que el buyer tenga una compra completada del resume sembrado. Es lo
 * que necesita /my-purchases para mostrar la biblioteca poblada y
 * /checkout/success para validar que la purchase pertenece al user.
 *
 * Idempotente vía upsert por id. payment_id se deja en null para no chocar
 * con la idempotencia del webhook (no tenemos uno asociado de verdad).
 */
async function ensurePurchase(
  admin: SupabaseClient,
  buyerId: string,
  sellerId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin.from("purchases").upsert(
    {
      id: E2E_PURCHASE_ID,
      buyer_id: buyerId,
      seller_id: sellerId,
      resume_id: E2E_RESUME_ID,
      amount: 1000,
      platform_fee: 100,
      status: "completed",
      created_at: now,
    },
    { onConflict: "id" }
  );
  if (error) {
    console.warn("[e2e/seed] No se pudo asegurar la purchase:", error.message);
  }
}

/**
 * Asegura una materia (subjects) para los cursos grabados. `recorded_courses`
 * tiene FK obligatoria a subjects.id (NOT NULL), así que sin esto no podemos
 * sembrar ningún curso.
 */
async function ensureSubject(admin: SupabaseClient): Promise<void> {
  const { error } = await admin.from("subjects").upsert(
    {
      id: E2E_SUBJECT_ID,
      name: "Materia E2E Cursos",
      university: "Universidad E2E",
      career: "Carrera E2E",
    },
    { onConflict: "id" }
  );
  if (error) {
    console.warn("[e2e/seed] No se pudo asegurar el subject:", error.message);
  }
}

/**
 * Asegura un curso grabado publicado del seller. Idempotente vía upsert por id.
 * `total_duration_seconds` lo recalcula el trigger refresh_course_total_duration
 * al insertar los módulos, así que lo dejamos en su default.
 */
async function ensureRecordedCourse(
  admin: SupabaseClient,
  sellerId: string,
  id: string,
  title: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin.from("recorded_courses").upsert(
    {
      id,
      author_id: sellerId,
      subject_id: E2E_SUBJECT_ID,
      title,
      description: "Curso sembrado para tests E2E.",
      course_type: "curso_completo",
      price_ars: 2500,
      is_published: true,
      published_at: now,
      deleted_at: null,
    },
    { onConflict: "id" }
  );
  if (error) {
    console.warn(
      `[e2e/seed] No se pudo asegurar el curso ${id}:`,
      error.message
    );
  }
}

/**
 * Asegura un módulo del curso. Idempotente vía upsert por id.
 * El trigger del curso recalcula total_duration_seconds del recorded_course.
 */
async function ensureCourseModule(
  admin: SupabaseClient,
  id: string,
  courseId: string
): Promise<void> {
  const { error } = await admin.from("course_modules").upsert(
    {
      id,
      course_id: courseId,
      position: 1,
      title: "Módulo 1 E2E",
      description: "Módulo sembrado para tests E2E.",
      duration_seconds: 600,
    },
    { onConflict: "id" }
  );
  if (error) {
    console.warn(
      `[e2e/seed] No se pudo asegurar el módulo ${id}:`,
      error.message
    );
  }
}

/**
 * Asegura una inscripción completada del buyer al curso. Replica el patrón de
 * ensurePurchase: status=completed, sin payment_id real. Esto es lo que /my-purchases
 * tab Cursos lee y lo que hace que /cursos/[id] muestre "Ver curso" en vez del
 * botón "Inscribirme".
 *
 * Usa onConflict por (course_id, student_id) además de id, porque la tabla
 * tiene unique(course_id, student_id): si una corrida vieja insertó una row
 * con un id distinto para el mismo par, upsert por id fallaría.
 */
async function ensureCourseEnrollment(
  admin: SupabaseClient,
  buyerId: string
): Promise<void> {
  const { error } = await admin.from("course_enrollments").upsert(
    {
      id: E2E_ENROLLMENT_ID,
      course_id: E2E_COURSE_ID,
      student_id: buyerId,
      amount: 2500,
      platform_fee: 250,
      seller_amount: 2250,
      status: "completed",
    },
    { onConflict: "course_id,student_id" }
  );
  if (error) {
    console.warn(
      "[e2e/seed] No se pudo asegurar el course enrollment:",
      error.message
    );
  }
}

/**
 * Marca al seller como tutor (`profiles.is_tutor=true`). La página
 * `/tutores/[id]` devuelve 404 si el perfil no es tutor Y no tiene
 * tutor_subjects. Con esto el detalle público existe aunque saquemos las
 * materias en el futuro.
 */
async function ensureSellerIsTutor(
  admin: SupabaseClient,
  sellerId: string
): Promise<void> {
  const { error } = await admin
    .from("profiles")
    .update({ is_tutor: true })
    .eq("id", sellerId);
  if (error) {
    console.warn(
      "[e2e/seed] No se pudo marcar al seller como tutor:",
      error.message
    );
  }
}

/**
 * Asegura una oferta activa del seller para la materia E2E. La fila se ve en
 * /explorar?tab=particulares (tutor_subjects con is_active=true) y se usa
 * para mostrar el precio en /tutores/[id].
 */
async function ensureTutorSubject(
  admin: SupabaseClient,
  sellerId: string
): Promise<void> {
  const { error } = await admin.from("tutor_subjects").upsert(
    {
      id: E2E_TUTOR_SUBJECT_ID,
      tutor_id: sellerId,
      subject_id: E2E_SUBJECT_ID,
      hourly_rate_ars: 3500,
      is_active: true,
    },
    { onConflict: "tutor_id,subject_id" }
  );
  if (error) {
    console.warn(
      "[e2e/seed] No se pudo asegurar el tutor_subject:",
      error.message
    );
  }
}

/**
 * Ventana semanal de disponibilidad del seller. Para que el motor de slots
 * tenga al menos una franja real (los lunes 14:00-18:00 online). El motor de
 * slots usa el "now" real, así que no necesitamos sembrar fechas absolutas.
 */
async function ensureTutorAvailability(
  admin: SupabaseClient,
  sellerId: string
): Promise<void> {
  const { error } = await admin.from("tutor_availability").upsert(
    {
      id: E2E_TUTOR_AVAILABILITY_ID,
      tutor_id: sellerId,
      day_of_week: 1, // lunes (0=domingo, 6=sábado)
      start_time: "14:00",
      end_time: "18:00",
      modality: "online",
    },
    { onConflict: "id" }
  );
  if (error) {
    console.warn(
      "[e2e/seed] No se pudo asegurar la availability:",
      error.message
    );
  }
}

/**
 * Calcula el próximo lunes a las 14:00 (hora local del runner). Se usa para
 * que el booking sembrado caiga en la pestaña "Próximas" de /clases sin
 * importar cuándo corra el seed.
 */
function nextMondayAt14(): string {
  const now = new Date();
  const daysUntilMonday = (1 - now.getDay() + 7) % 7 || 7; // siempre futuro
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilMonday);
  next.setHours(14, 0, 0, 0);
  return next.toISOString();
}

/**
 * Asegura una reserva confirmada del buyer con el seller. La query de /clases
 * filtra por student_id, y BookingsList agrupa por scheduled_at >= now() para
 * "Próximas". Por eso sembramos siempre en el próximo lunes futuro.
 */
async function ensureTutorBooking(
  admin: SupabaseClient,
  buyerId: string,
  sellerId: string
): Promise<void> {
  const { error } = await admin.from("tutor_bookings").upsert(
    {
      id: E2E_TUTOR_BOOKING_ID,
      tutor_id: sellerId,
      student_id: buyerId,
      subject_id: E2E_SUBJECT_ID,
      scheduled_at: nextMondayAt14(),
      duration_minutes: 60,
      status: "confirmed",
      modality: "online",
      amount: 3500,
      hourly_rate_ars: 3500,
      platform_fee: 350,
      seller_amount: 3150,
      initial_message: "Reserva sembrada para tests E2E.",
    },
    { onConflict: "id" }
  );
  if (error) {
    console.warn(
      "[e2e/seed] No se pudo asegurar el tutor_booking:",
      error.message
    );
  }
}

/**
 * Asegura una consulta del buyer sobre el resume comprado, anclada a la
 * página 1. La fila la lee el dashboard del seller (tab Consultas) vía el
 * admin client y el panel del viewer vía /api/material-questions.
 */
async function ensureMaterialQuestion(
  admin: SupabaseClient,
  buyerId: string
): Promise<void> {
  // OJO: acá usamos INSERT (no upsert) a propósito. La tabla tiene un trigger
  // BEFORE UPDATE (validate_material_question_update) que exige auth.uid() != null
  // como primer chequeo. El seed corre con service role, donde auth.uid() es null,
  // así que cualquier UPDATE —y un upsert sobre fila existente se resuelve como
  // UPDATE— explota con "No autorizado para modificar esta consulta". El INSERT no
  // pasa por ese trigger. Como el contenido es determinístico, si la fila ya
  // existe la dejamos intacta e ignoramos el duplicate key (23505).
  const { error } = await admin.from("material_questions").insert({
    id: E2E_MATERIAL_QUESTION_ID,
    target_type: "resume",
    resume_id: E2E_RESUME_ID,
    author_id: buyerId,
    title: E2E_MATERIAL_QUESTION_TITLE,
    body: E2E_MATERIAL_QUESTION_BODY,
    anchor_page: 1,
    status: "open",
    is_anonymous_to_buyers: false,
  });
  // 23505 = unique_violation: la consulta ya estaba sembrada, es idempotente.
  if (error && error.code !== "23505") {
    console.warn(
      "[e2e/seed] No se pudo asegurar la material_question:",
      error.message
    );
  }
}

/**
 * Crea (o actualiza) los usuarios de prueba en Supabase y deja limpio su
 * estado de sesiones. Idempotente.
 *
 * Además siembra un resume publicado del seller, las credenciales de MP del
 * seller y una compra completada del buyer (el flujo "compré, ahora lo veo en
 * mi biblioteca" queda listo de fábrica).
 */
export async function seedE2EIdentities(): Promise<SeededIdentities> {
  const admin = adminClient();
  const buyerId = await ensureUser(admin, E2E_BUYER);
  const sellerId = await ensureUser(admin, E2E_SELLER);

  // Limpieza de devices: cada corrida arranca sin device cookie, así que sin
  // esto pasaríamos del límite a las pocas ejecuciones.
  await cleanUserDevices(admin, buyerId);
  await cleanUserDevices(admin, sellerId);

  // Datos de negocio mínimos para los flujos de compra y biblioteca.
  await ensureSellerMpCredentials(admin, sellerId);
  // Dos resumes: uno ya comprado por el buyer (lo ve en la biblioteca) y otro
  // sin comprar (para que el spec de compra encuentre el botón "Comprar").
  await ensureResume(admin, sellerId, E2E_RESUME_ID, E2E_RESUME_TITLE);
  await ensureResume(
    admin,
    sellerId,
    E2E_UNPURCHASED_RESUME_ID,
    "Apunte E2E sin comprar"
  );
  await ensurePurchase(admin, buyerId, sellerId);

  // Cursos grabados (Fase 3C): un subject, dos cursos publicados del seller
  // (uno con enrollment completed del buyer para la biblioteca, otro libre
  // para que el spec de detalle vea el botón "Inscribirme"), un módulo en
  // cada uno y la inscripción completed.
  await ensureSubject(admin);
  await ensureRecordedCourse(
    admin,
    sellerId,
    E2E_COURSE_ID,
    "Curso E2E de prueba"
  );
  await ensureRecordedCourse(
    admin,
    sellerId,
    E2E_UNENROLLED_COURSE_ID,
    "Curso E2E sin inscribir"
  );
  await ensureCourseModule(admin, E2E_MODULE_ID, E2E_COURSE_ID);
  await ensureCourseModule(
    admin,
    E2E_UNENROLLED_MODULE_ID,
    E2E_UNENROLLED_COURSE_ID
  );
  await ensureCourseEnrollment(admin, buyerId);

  // Tutorías (Fase 3D): seller marcado como tutor, oferta activa para
  // E2E_SUBJECT_ID, disponibilidad semanal y un booking confirmado del buyer
  // en el próximo lunes futuro.
  await ensureSellerIsTutor(admin, sellerId);
  await ensureTutorSubject(admin, sellerId);
  await ensureTutorAvailability(admin, sellerId);
  await ensureTutorBooking(admin, buyerId, sellerId);

  // Material questions (Fase 3F): consulta del buyer sobre el resume comprado.
  await ensureMaterialQuestion(admin, buyerId);

  return { buyerId, sellerId };
}
