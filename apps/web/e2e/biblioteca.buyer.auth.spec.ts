import { test, expect } from '@playwright/test';

// Biblioteca del buyer: lo que ve después de comprar. El seed le deja una
// compra completada del apunte sembrado y una inscripción completada al
// curso sembrado, así que tanto la vista "Apuntes" como la de "Cursos"
// arrancan pobladas. Ambos caminos son determinísticos.

test.describe('Biblioteca (buyer)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-purchases');
  });

  test('renderiza el heading de la biblioteca y los dos tabs', async ({ page }) => {
    // THEN
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mi biblioteca' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apuntes', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cursos', exact: true })).toBeVisible();
  });

  test('muestra el apunte comprado en la pestaña Apuntes', async ({ page }) => {
    // THEN: el apunte sembrado aparece como card en la grilla.
    // (La pestaña "Apuntes" es la activa por defecto.)
    await expect(page.getByText('Apunte E2E de prueba')).toBeVisible();
  });

  test('muestra el curso inscripto en la pestaña Cursos', async ({ page }) => {
    // WHEN: cambia a la vista de cursos
    await page.getByRole('button', { name: 'Cursos', exact: true }).click();

    // THEN: el curso sembrado con enrollment completed aparece como card.
    // (El otro curso del seed, "Curso E2E sin inscribir", NO debe aparecer
    // acá porque el buyer no está inscripto a ese.)
    await expect(page.getByText('Curso E2E de prueba')).toBeVisible();
  });
});
