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

  return { buyerId, sellerId };
}
