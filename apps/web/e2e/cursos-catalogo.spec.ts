import { test, expect } from '@playwright/test';

// Catálogo público de cursos grabados. El seed deja dos cursos publicados
// del seller: uno con inscripción completed del buyer ("Curso E2E de prueba")
// y otro libre ("Curso E2E sin inscribir"). Ambos son data pública: cualquier
// visitante (incluido el no autenticado) los ve en /explorar?tab=grabadas.

test.describe('Catálogo de cursos grabados (público)', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: un visitante abre la vertical de cursos grabados.
    await page.goto('/explorar?tab=grabadas');
  });

  test('la pestaña Grabadas queda seleccionada al entrar por query string', async ({
    page,
  }) => {
    // THEN: el tab "Grabadas" arranca activo (no hay que clickearlo).
    await expect(page.getByRole('tab', { name: 'Grabadas' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('muestra los cursos publicados sembrados', async ({ page }) => {
    // THEN: los dos cursos del seller aparecen como cards en la grilla. Ambos
    // están publicados; la única diferencia es la inscripción del buyer.
    // Usamos el rol heading porque el título aparece dos veces por card
    // (cover + body) y "Curso E2E de prueba" es prefijo de "Curso E2E sin
    // inscribir", así que getByText sería ambiguo.
    await expect(
      page.getByRole('heading', { name: 'Curso E2E de prueba', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Curso E2E sin inscribir',
        exact: true,
      })
    ).toBeVisible();
  });
});
