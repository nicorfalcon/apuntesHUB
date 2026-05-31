import { test, expect } from '@playwright/test';

// Flujo de login mockeando el endpoint /api/auth/login con page.route(). Así
// probamos la lógica de la UI (éxito vs. límite de dispositivos) de forma
// determinística, sin credenciales reales ni depender de Supabase.

test.describe('Login — respuesta de éxito', () => {
  test('redirige a /explorar cuando el backend responde ok', async ({ page }) => {
    // GIVEN: el endpoint de login responde "ok"
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
    });

    await page.goto('/login');
    // Esperamos que React termine de hidratar el formulario. Sin esto, en WebKit
    // el click puede dispararse antes de que el onSubmit con preventDefault esté
    // atachado y el browser hace un submit nativo que recarga /login.
    await page.waitForLoadState('networkidle');

    // WHEN: completa credenciales y envía
    await page.getByLabel('Email').fill('user@uni.edu.ar');
    await page.getByLabel('Contraseña', { exact: true }).fill('claveCualquiera');
    await Promise.all([
      page.waitForResponse('**/api/auth/login'),
      page.getByRole('button', { name: 'Ingresar' }).click(),
    ]);

    // THEN: queda en /explorar (destino por defecto del login)
    await expect(page).toHaveURL(/\/explorar$/);
  });
});

test.describe('Login — límite de dispositivos', () => {
  test('lleva al selector de dispositivos y muestra las sesiones activas', async ({
    page,
  }) => {
    // GIVEN: el endpoint responde que se alcanzó el límite de dispositivos, con
    // dos sesiones activas y una recomendada (la más inactiva).
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'session_limit_exceeded',
          login_intent_token: 'token-de-prueba',
          active_sessions: [
            {
              id: 's1',
              label: 'Chrome en Windows',
              user_agent: 'Mozilla/5.0 (Windows NT 10.0)',
              last_seen_at: '2026-05-20T10:00:00.000Z',
              is_current: false,
            },
            {
              id: 's2',
              label: 'Safari en macOS',
              user_agent: 'Mozilla/5.0 (Macintosh)',
              last_seen_at: '2026-05-27T10:00:00.000Z',
              is_current: false,
            },
          ],
          recommended_session_id: 's1',
        }),
      });
    });

    await page.goto('/login');
    // Ver comentario en el test anterior: en WebKit hay que esperar la
    // hidratación de React antes del click para evitar un submit nativo.
    await page.waitForLoadState('networkidle');

    // WHEN: completa credenciales y envía
    await page.getByLabel('Email').fill('user@uni.edu.ar');
    await page.getByLabel('Contraseña', { exact: true }).fill('claveCualquiera');
    await Promise.all([
      page.waitForResponse('**/api/auth/login'),
      page.getByRole('button', { name: 'Ingresar' }).click(),
    ]);

    // THEN: navega al selector de dispositivos
    await expect(page).toHaveURL(/\/login\/devices$/);
    await expect(
      page.getByRole('heading', { name: 'Estás conectado en otros dispositivos' })
    ).toBeVisible();

    // y muestra ambas sesiones, marcando la recomendada (la más inactiva, s1)
    await expect(page.getByText('Chrome en Windows')).toBeVisible();
    await expect(page.getByText('Safari en macOS')).toBeVisible();
    await expect(page.getByText(/Recomendado/)).toBeVisible();
  });
});
