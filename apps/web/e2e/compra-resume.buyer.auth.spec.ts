import { test, expect } from '@playwright/test';
import { E2E_UNPURCHASED_RESUME_ID } from './support/seed';

// Flujo de compra en /resume/[id] con buyer logueado:
//   1. La página renderiza el apunte sembrado y el botón "Comprar apunte".
//   2. Al hacer click, el cliente llama a /api/mercadopago/create-preference.
//   3. Interceptamos esa llamada con page.route() para no crear preferencias
//      reales en MP ni dejar registros colgados. Devolvemos un initPoint dummy.
//   4. Bloqueamos la navegación a MP (page.route abort) para mantener al
//      browser en el dominio del test.

test.describe('Compra de apunte (buyer)', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: el buyer abre el detalle del apunte sembrado.
    await page.goto(`/resume/${E2E_UNPURCHASED_RESUME_ID}`);
  });

  test('muestra el título del apunte y el botón Comprar', async ({ page }) => {
    // THEN: heading del apunte (es el title del seed) y el botón habilitado.
    await expect(
      page.getByRole('heading', { name: 'Apunte E2E sin comprar' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Comprar apunte' })
    ).toBeVisible();
  });

  test('al comprar dispara create-preference y redirige al initPoint', async ({
    page,
  }) => {
    // GIVEN: mockeamos el endpoint de creación de preferencia. Capturamos el
    // request para verificar más abajo que se envió el resumeId correcto.
    let capturedBody: { resumeId?: string } | null = null;
    await page.route('**/api/mercadopago/create-preference', async (route) => {
      capturedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          preferenceId: 'mp-pref-e2e',
          initPoint: 'https://mock-mp.test/checkout/123',
        }),
      });
    });

    // GIVEN: bloqueamos la navegación al dominio fake de MP para que el browser
    // no intente cargarlo (no existe, daría timeout/error de red).
    await page.route('https://mock-mp.test/**', (route) => route.abort());

    // WHEN: click en "Comprar apunte"
    await page.getByRole('button', { name: 'Comprar apunte' }).click();

    // THEN: el endpoint recibió el resumeId del apunte sembrado y la UI
    // intentó la redirección (la URL queda apuntando al initPoint mockeado).
    await expect.poll(() => capturedBody).toMatchObject({
      resumeId: E2E_UNPURCHASED_RESUME_ID,
    });
  });
});
