import { test, expect } from '@playwright/test';

// Control de acceso (negativo) para usuarios SIN sesión. Es un spec público (sin
// storageState), así que el browser no lleva cookies de auth: las rutas privadas
// deben redirigir al login en vez de renderizar. Prueba que el gate de sesión
// realmente bloquea, no solo el camino feliz.

test.describe('Rutas privadas sin sesión', () => {
  test('/my-purchases redirige al login', async ({ page }) => {
    await page.goto('/my-purchases');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test('/clases redirige al login', async ({ page }) => {
    await page.goto('/clases');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test('/sell/new redirige al login', async ({ page }) => {
    await page.goto('/sell/new');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
