import { test, expect } from '@playwright/test';
import { E2E_ENROLLMENT_ID } from './support/seed';

// Páginas de resultado del checkout de curso grabado, con buyer logueado.
// Análogas a las de tutoría. El poller de la success arranca en "pending" y
// pollea /api/courses/enrollments/[id]/status, así que lo mockeamos a
// "completed" para que sea determinístico y no dependa del timing real.

test.describe('Checkout de curso (buyer)', () => {
  test('success: muestra "¡Estás inscripto!" cuando el estado es completed', async ({
    page,
  }) => {
    // GIVEN: el endpoint de estado devuelve completed.
    await page.route(
      `**/api/courses/enrollments/${E2E_ENROLLMENT_ID}/status`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'completed' }),
        });
      }
    );

    // WHEN: el buyer cae en la success con su enrollment.
    await page.goto(
      `/checkout/curso/success?enrollment_id=${E2E_ENROLLMENT_ID}`
    );

    // THEN: el poller resuelve a inscripto.
    await expect(
      page.getByRole('heading', { name: '¡Estás inscripto!' })
    ).toBeVisible();
  });

  test('success: sin enrollment_id redirige a explorar cursos grabados', async ({
    page,
  }) => {
    await page.goto('/checkout/curso/success');

    await expect(page).toHaveURL(/\/explorar\?tab=grabadas$/);
  });

  test('failure: muestra el mensaje de pago no procesado', async ({ page }) => {
    await page.goto(
      `/checkout/curso/failure?enrollment_id=${E2E_ENROLLMENT_ID}`
    );

    await expect(
      page.getByRole('heading', { name: 'El pago no se pudo procesar' })
    ).toBeVisible();
  });
});
