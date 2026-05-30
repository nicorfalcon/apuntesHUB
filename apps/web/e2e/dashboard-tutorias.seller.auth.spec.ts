import { test, expect } from '@playwright/test';
import { E2E_BUYER } from './support/seed';

// Vista del tutor en /profile/profesor tab "Clases recibidas".
// La query del page lee tutor_bookings por tutor_id=seller.id, así que el
// booking sembrado del buyer aparece como card con el nombre del alumno.
// El dashboard de venta (/sell/dashboard tab "Clases") solo redirige acá,
// por eso testeamos directamente este perfil docente.

test.describe('Clases recibidas (seller)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile/profesor');
  });

  test('renderiza el heading del perfil de profesor', async ({ page }) => {
    // THEN
    await expect(
      page.getByRole('heading', { level: 1, name: 'Perfil de profesor' })
    ).toBeVisible();
  });

  test('al cambiar a "Clases recibidas" muestra el booking del buyer', async ({
    page,
  }) => {
    // WHEN: navega al tab de bookings recibidos.
    await page.getByRole('button', { name: 'Clases recibidas' }).click();

    // THEN: aparece el heading con el nombre del alumno (BookingsList usa
    // un h3 por card) y el badge "Confirmada" en algún lugar del tab.
    await expect(
      page.getByRole('heading', { level: 3, name: E2E_BUYER.fullName })
    ).toBeVisible();
    await expect(page.getByText('Confirmada').first()).toBeVisible();
  });
});
