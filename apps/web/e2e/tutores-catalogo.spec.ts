import { test, expect } from '@playwright/test';

// Catálogo público de profesores particulares. El seed marca al seller como
// tutor (profiles.is_tutor=true), le agrega una oferta activa de Materia E2E
// Cursos y una franja de disponibilidad. Eso lo hace aparecer en la grilla
// de /explorar?tab=particulares para cualquier visitante.

test.describe('Catálogo de profesores particulares (público)', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: un visitante abre la vertical de profesores particulares.
    await page.goto('/explorar?tab=particulares');
  });

  test('la pestaña Profesores particulares queda seleccionada por query string', async ({
    page,
  }) => {
    // THEN: el tab "Profesores particulares" arranca activo.
    await expect(
      page.getByRole('tab', { name: 'Profesores particulares' })
    ).toHaveAttribute('aria-selected', 'true');
  });

  test('muestra al tutor sembrado', async ({ page }) => {
    // THEN: el seller marcado como tutor aparece como card con su display_name.
    await expect(
      page.getByRole('heading', { level: 3, name: 'Seller E2E' })
    ).toBeVisible();
  });
});
