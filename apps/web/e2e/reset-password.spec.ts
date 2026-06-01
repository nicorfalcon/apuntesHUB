import { test, expect } from '@playwright/test';
import { gotoHydrated } from './support/hydration';

// /reset-password: form con validaciones cliente (longitud mínima 6, match
// con confirmación). El submit pega supabase.auth.updateUser → /auth/v1/user
// (PUT) y luego signOut → /auth/v1/logout. Cubrimos las validaciones cliente
// (no requieren backend) + el toggle de mostrar/ocultar contraseña.

test.describe('Reset password (público)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHydrated(page, '/reset-password');
  });

  test('renderiza el heading y los inputs del form', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Nueva contraseña' })
    ).toBeVisible();
    await expect(page.getByLabel('Nueva contraseña')).toBeVisible();
    await expect(page.getByLabel('Confirmar contraseña')).toBeVisible();
  });

  test('al enviar con menos de 6 caracteres, muestra el error de largo', async ({
    page,
  }) => {
    await page.getByLabel('Nueva contraseña').fill('abc');
    await page.getByLabel('Confirmar contraseña').fill('abc');
    // Submit del form (botón principal del formulario).
    await page
      .getByRole('button', { name: /Cambiar|Restablecer|Guardar/i })
      .click();

    await expect(page.getByText(/al menos 6 caracteres/i)).toBeVisible();
  });

  test('al enviar con contraseñas que no coinciden, muestra el mismatch', async ({
    page,
  }) => {
    await page.getByLabel('Nueva contraseña').fill('abcdef');
    await page.getByLabel('Confirmar contraseña').fill('abcdeg');
    await page
      .getByRole('button', { name: /Cambiar|Restablecer|Guardar/i })
      .click();

    await expect(
      page.getByText(/Las contraseñas no coinciden/i)
    ).toBeVisible();
  });

  test('el botón "Mostrar contraseña" cambia el type del input a text', async ({
    page,
  }) => {
    const passwordInput = page.getByLabel('Nueva contraseña');
    // Estado inicial: type=password (texto oculto).
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await page
      .getByRole('button', { name: 'Mostrar contraseña' })
      .first()
      .click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
