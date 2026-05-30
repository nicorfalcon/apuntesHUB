import { test, expect } from '@playwright/test';

// /sell/dashboard del seller: stats agregados arriba y un tab por inventario
// (Apuntes, Cursos grabados, Consultas, Clases). El seed deja al seller con
// 2 apuntes (1 vendido), 2 cursos (1 con enrollment) y 1 booking confirmado,
// así que tanto las stats como los listados de Apuntes y Cursos arrancan
// poblados. El tab Clases solo redirige a /profile/profesor (ya cubierto en
// dashboard-tutorias.seller.auth.spec.ts), por eso no lo testeamos acá.

test.describe('Panel de ventas (seller)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sell/dashboard');
  });

  test('renderiza el heading y las stats principales', async ({ page }) => {
    // THEN: heading del panel + métricas agregadas con los conteos del seed.
    await expect(
      page.getByRole('heading', { level: 1, name: 'Panel de ventas' })
    ).toBeVisible();
    // Hint de la tile "Publicaciones": "2 apuntes y 2 cursos."
    await expect(
      page.getByText('2 apuntes y 2 cursos.', { exact: true })
    ).toBeVisible();
  });

  test('el tab Apuntes (default) muestra los dos apuntes sembrados', async ({
    page,
  }) => {
    // THEN: ambos resúmenes del seed aparecen como cards (h3 con el title).
    await expect(
      page.getByRole('heading', { level: 3, name: 'Apunte E2E de prueba' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: 'Apunte E2E sin comprar',
      })
    ).toBeVisible();
  });

  test('al cambiar al tab Cursos aparecen los dos cursos sembrados', async ({
    page,
  }) => {
    // WHEN: navega al tab de cursos. El botón del TabButton contiene "Cursos
    // grabados" como label, así que matcheamos con substring.
    await page
      .getByRole('button', { name: /Cursos grabados/ })
      .click();

    // THEN: ambos cursos del seed aparecen como cards.
    await expect(
      page.getByRole('heading', { level: 3, name: 'Curso E2E de prueba' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 3, name: 'Curso E2E sin inscribir' })
    ).toBeVisible();
  });

  test('al cambiar al tab Consultas se monta el panel del manager', async ({
    page,
  }) => {
    // WHEN
    await page.getByRole('button', { name: /Consultas/ }).click();

    // THEN: el heading "Consultas" del manager. El contenido (cards de
    // preguntas concretas) lo cubre preguntas.seller.auth.spec.ts.
    await expect(
      page.getByRole('heading', { level: 2, name: 'Consultas', exact: true })
    ).toBeVisible();
  });
});
