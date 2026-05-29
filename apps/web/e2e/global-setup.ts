import { request, type FullConfig } from "@playwright/test";
import fs from "fs";
import path from "path";
import { loadDotEnvLocal } from "./support/env";
import { E2E_BUYER, E2E_SELLER, seedE2EIdentities } from "./support/seed";

const AUTH_DIR = path.resolve(__dirname, ".auth");
export const BUYER_STORAGE = path.join(AUTH_DIR, "buyer.json");
export const SELLER_STORAGE = path.join(AUTH_DIR, "seller.json");

/**
 * Login programático contra /api/auth/login y persistencia del storageState.
 * Usamos un APIRequestContext + un browser context puente: el endpoint setea
 * las cookies en el contexto de request, y desde ahí las copiamos a un
 * BrowserContext para guardarlas con `storageState()` en el formato que
 * Playwright reusa por proyecto.
 */
async function loginAndSaveStorage(
  baseURL: string,
  email: string,
  password: string,
  storagePath: string
): Promise<void> {
  const apiContext = await request.newContext({ baseURL });
  const res = await apiContext.post("/api/auth/login", {
    data: { email, password, redirect_to: "/explorar" },
    headers: { "content-type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok() || body.status !== "ok") {
    await apiContext.dispose();
    throw new Error(
      `Login E2E falló para ${email}: status=${res.status()} body=${JSON.stringify(body)}`
    );
  }
  // storageState() del APIRequestContext devuelve cookies + origins compatibles
  // con el formato que consume browserContext.storageState.
  await apiContext.storageState({ path: storagePath });
  await apiContext.dispose();
}

/**
 * GlobalSetup: corre una vez antes de toda la suite E2E.
 *
 * 1. Carga .env.local (Playwright no lo hace solo).
 * 2. Siembra las identidades buyer/seller en Supabase (idempotente).
 * 3. Loguea ambas y guarda su sesión en e2e/.auth/{buyer,seller}.json.
 *
 * Si faltan los secrets de Supabase, NO falla: solo registra una advertencia y
 * sigue. Los specs públicos (sin auth) podrán correr igual; los specs auth-gated
 * fallarán explícitamente al no encontrar el storageState — que es lo que
 * queremos para no enmascarar problemas de configuración.
 */
async function globalSetup(_config: FullConfig): Promise<void> {
  loadDotEnvLocal();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.warn(
      "[e2e/global-setup] Faltan credenciales de Supabase. Saltando seed + login. " +
        "Los specs auth-gated van a fallar."
    );
    return;
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true });

  try {
    await seedE2EIdentities();
  } catch (err) {
    console.warn("[e2e/global-setup] Seed falló:", err);
    return;
  }

  const baseURL = "http://localhost:3000";
  await loginAndSaveStorage(
    baseURL,
    E2E_BUYER.email,
    E2E_BUYER.password,
    BUYER_STORAGE
  );
  await loginAndSaveStorage(
    baseURL,
    E2E_SELLER.email,
    E2E_SELLER.password,
    SELLER_STORAGE
  );
}

export default globalSetup;
