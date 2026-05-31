import { test, expect } from '@playwright/test';
import { E2E_UNPURCHASED_RESUME_ID, E2E_SELLER } from './support/seed';

// Perfil público del vendedor en /profile/[id]. Como el seller_id no es una
// constante (lo crea auth.admin.createUser), llegamos al perfil clickeando el
// link del vendedor desde el detalle de un apunte público. Eso prueba además la
// navegación apunte -> perfil del vendedor. Es público: no requiere sesión.

test.describe('Perfil público del vendedor', () => {
  test('navega desde el detalle del apunte al perfil y muestra el nombre del vendedor', async ({
    page,
  }) => {
    // GIVEN: el detalle de un apunte publicado del seller.
    await page.goto(`/resume/${E2E_UNPURCHASED_RESUME_ID}`);

    // WHEN: hace click en el nombre del vendedor (link a su perfil público).
    await page
      .getByRole('link', { name: E2E_SELLER.fullName, exact: true })
      .click();

    // THEN: la URL queda en /profile/<sellerId> y el heading es su display_name.
    await expect(page).toHaveURL(/\/profile\/[0-9a-f-]+$/);
    await expect(
      page.getByRole('heading', { level: 1, name: E2E_SELLER.fullName })
    ).toBeVisible();
  });
});
