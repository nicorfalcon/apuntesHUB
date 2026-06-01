import { test, expect } from '@playwright/test';
import { gotoHydrated } from './support/hydration';

// El botón "Continuar con Google" dispara supabase.auth.signInWithOAuth({
// provider: "google" }), que internamente pega a /auth/v1/authorize?provider=google
// y redirige al provider real. Para no salir del dominio del test, bloqueamos
// la respuesta y verificamos que el fetch al endpoint de Supabase haya salido
// con el provider correcto.

test.describe('OAuth Google (público)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHydrated(page, '/login');
  });

  test('el botón "Continuar con Google" está visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Continuar con Google/ })
    ).toBeVisible();
  });

  test('al click, dispara fetch a /auth/v1/authorize con provider=google', async ({
    page,
  }) => {
    // GIVEN: capturamos el fetch al endpoint de OAuth de Supabase. Lo
    // fulfillamos con un fake URL para que el browser intente redirigir
    // pero a un dominio que abortamos abajo.
    let authorizeUrl: string | null = null;
    await page.route('**/auth/v1/authorize**', (route) => {
      authorizeUrl = route.request().url();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://mock-google.test/auth' }),
      });
    });
    await page.route('https://mock-google.test/**', (route) => route.abort());

    // WHEN
    await page.getByRole('button', { name: /Continuar con Google/ }).click();

    // THEN: la URL del fetch incluye provider=google.
    await expect.poll(() => authorizeUrl).toContain('provider=google');
  });
});
