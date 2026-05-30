import { test, expect } from '@playwright/test';
import { E2E_SELLER } from './support/seed';

// /clases del buyer: la query lee tutor_bookings del student. El seed deja
// un booking confirmado del buyer con el seller para el próximo lunes 14:00,
// así que la pestaña "Próximas" del StudentBookingsList arranca poblada.

test.describe('Mis clases (buyer)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clases');
  });

  test('renderiza el heading "Mis clases"', async ({ page }) => {
    // THEN
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mis clases' })
    ).toBeVisible();
  });

  test('muestra el booking confirmado con el tutor sembrado', async ({
    page,
  }) => {
    // THEN: el card del booking contiene "Confirmada" + el nombre del tutor
    // (relación profiles!tutor_id.display_name). Si el seed se rompiera o
    // el booking quedara en el pasado, este assert falla.
    const bookingCard = page
      .getByRole('article')
      .filter({ hasText: 'Confirmada' })
      .filter({ hasText: E2E_SELLER.fullName });
    await expect(bookingCard).toBeVisible();
  });
});
