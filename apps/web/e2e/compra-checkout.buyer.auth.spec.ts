import { test, expect } from '@playwright/test';
import { E2E_PURCHASE_ID } from './support/seed';

// Flujos de checkout post-pago. Estas dos páginas son server components con
// gate de auth (redirect a /login si no hay sesión) y leen la compra de la
// DB. Acá probamos los caminos que NO necesitan una purchase sembrada: el
// failure y el success cuando no llega el purchase_id (caminos de error que
// igual queremos que rendericen bien).

test.describe('Checkout failure (buyer)', () => {
  test('muestra el mensaje de pago no completado y el link para volver', async ({
    page,
  }) => {
    // GIVEN: el buyer abre la página de failure sin purchase_id en la URL.
    // (Es el caso real cuando MP redirige sin parámetros.)
    await page.goto('/checkout/failure');

    // THEN: ve el heading explicativo y el link de volver a explorar.
    await expect(
      page.getByRole('heading', { name: 'El pago no se completó' })
    ).toBeVisible();
    await expect(
      page.getByText(/Tu pago fue rechazado o cancelado/)
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Volver a explorar' })
    ).toBeVisible();
  });
});

test.describe('Checkout success (buyer)', () => {
  test('redirige a /explorar cuando falta el purchase_id', async ({ page }) => {
    // GIVEN / WHEN
    await page.goto('/checkout/success');

    // THEN: el server component redirige porque no hay compra que validar.
    await expect(page).toHaveURL(/\/explorar(\?|$)/);
  });

  test('muestra "Pago confirmado" cuando el polling devuelve completed', async ({
    page,
  }) => {
    // GIVEN: interceptamos el polling para devolver completed en el primer
    // intento (el componente reintenta cada 3s; con esto cortamos esa espera).
    await page.route(
      `**/api/purchases/${E2E_PURCHASE_ID}/status`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'completed' }),
        });
      }
    );

    // WHEN: el buyer llega a la página de éxito con la purchase sembrada.
    await page.goto(`/checkout/success?purchase_id=${E2E_PURCHASE_ID}`);

    // THEN: el poller refleja el estado completed y aparece el link a la biblioteca.
    await expect(
      page.getByRole('heading', { name: 'Pago confirmado' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Ver mi biblioteca' })
    ).toBeVisible();
  });
});
