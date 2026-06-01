import { test, expect } from '@playwright/test';
import { gotoHydrated } from './support/hydration';

// /forgot-password: el form llama supabase.auth.resetPasswordForEmail() desde
// el browser, que internamente pega a `POST <SUPABASE_URL>/auth/v1/recover`.
// Lo mockeamos con page.route() para no enviar mails reales ni gatillar rate
// limit en Supabase durante CI.

test.describe('Forgot password (público)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHydrated(page, '/forgot-password');
  });

  test('renderiza el heading y el form vacío', async ({ page }) => {
    // THEN
    await expect(
      page.getByRole('heading', { level: 1, name: 'Recuperá tu contraseña' })
    ).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Enviar enlace' })
    ).toBeVisible();
  });

  test('al enviar exitosamente, muestra el mensaje de email enviado', async ({
    page,
  }) => {
    // GIVEN: mockeamos el endpoint de Supabase. resetPasswordForEmail pega a
    // /auth/v1/recover; cualquier respuesta 2xx es éxito para el client.
    await page.route('**/auth/v1/recover**', (route) =>
      route.fulfill({ status: 200, body: '{}' })
    );

    // WHEN
    await page.getByLabel('Email').fill('juan@test.com');
    await page.getByRole('button', { name: 'Enviar enlace' }).click();

    // THEN: el card de éxito reemplaza el form.
    await expect(
      page.getByText(/Te enviamos un email/)
    ).toBeVisible();
  });

  test('al recibir rate limit del backend, muestra mensaje específico', async ({
    page,
  }) => {
    // GIVEN: respuesta 4xx con mensaje "rate limit"
    await page.route('**/auth/v1/recover**', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ msg: 'email rate limit exceeded' }),
      })
    );

    // WHEN
    await page.getByLabel('Email').fill('juan@test.com');
    await page.getByRole('button', { name: 'Enviar enlace' }).click();

    // THEN: el copy específico de rate limit aparece (no el genérico).
    await expect(
      page.getByText(/demasiadas solicitudes/i)
    ).toBeVisible();
  });
});
