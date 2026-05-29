import { test, expect } from '@playwright/test';

// Smoke test del setup auth-gated. Valida que el storageState del buyer (creado
// por globalSetup en e2e/.auth/buyer.json) sirve para que el server reconozca
// la sesión y NO redirija a /login.
//
// Si este test pasa, todo el Grupo 3 de la fase (compra, biblioteca, etc.) tiene
// la infraestructura lista. Si falla, el problema es de setup, no del flujo.

test.describe('Smoke auth (buyer)', () => {
  test('puede entrar a /my-purchases sin redirigir al login', async ({ page }) => {
    // WHEN
    await page.goto('/my-purchases');

    // THEN: la URL final es /my-purchases (no /login).
    await expect(page).toHaveURL(/\/my-purchases$/);
  });
});
