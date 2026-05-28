import { test, expect } from '@playwright/test';

// Grupo A — Navegación pública (sin login).
// Cada test se lee como una historia: GIVEN preparo el estado, WHEN ejecuto la
// acción, THEN verifico el resultado. Todos parten desde la home, así que el
// "goto" común va en un beforeEach para que cada test sea independiente.

test.describe('Navegación pública desde la home', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: el visitante (sin sesión) abre la página de inicio.
    await page.goto('/');
  });

  test('la home muestra el título de la marca en la pestaña', async ({ page }) => {
    // WHEN: la home ya cargó (lo hizo el beforeEach).
    // THEN: el título del documento es el de apuntesHUB.
    // Usamos una expresión regular para no atarnos a la frase exacta completa.
    await expect(page).toHaveTitle(/apuntesHUB/);
  });

  test('la home muestra el encabezado principal', async ({ page }) => {
    // THEN: se ve el headline del hero. getByRole('heading') es un locator
    // semántico (apunta al <h1>), más robusto que buscar por clases CSS.
    await expect(
      page.getByRole('heading', { name: /apuntes encuentran su lugar/i })
    ).toBeVisible();
  });

  test('el visitante puede ir a la página de inicio de sesión', async ({ page }) => {
    // WHEN: hace clic en el enlace "Ingresar" de la barra superior.
    await page.getByRole('link', { name: 'Ingresar' }).click();

    // THEN: queda en /login y ve el encabezado de esa página.
    // No usamos waitForTimeout: el auto-wait de Playwright espera solo a que
    // la navegación termine y el heading sea visible.
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole('heading', { name: 'Iniciá sesión' })
    ).toBeVisible();
  });

  test('el visitante puede ir a la página de registro', async ({ page }) => {
    // WHEN: hace clic en el botón "Registrarse".
    await page.getByRole('link', { name: 'Registrarse' }).click();

    // THEN: queda en /register y ve el primer paso del formulario.
    await expect(page).toHaveURL(/\/register$/);
    await expect(
      page.getByRole('heading', { name: 'Creá tu cuenta' })
    ).toBeVisible();
  });
});
