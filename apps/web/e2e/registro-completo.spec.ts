import { test, expect } from '@playwright/test';

// Flujo de registro de 3 pasos (/register). El formulario valida en el cliente
// (noValidate + lógica propia), así que los pasos y errores son deterministas y
// no tocan el backend. Solo el envío final llama a Supabase: lo interceptamos
// con page.route() para no crear cuentas reales ni depender de la red.

test.describe('Registro — validaciones del paso de contraseña', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: el visitante abre el registro y completa el primer paso para llegar
    // al paso de contraseña.
    await page.goto('/register');
    await page.getByLabel('Nombre completo').fill('Juan Pérez');
    await page.getByLabel('Email').fill('juan@uni.edu.ar');
    await page.getByRole('button', { name: 'Continuar' }).click();
    // El heading del paso 2 confirma que avanzamos (auto-wait, sin sleeps).
    await expect(
      page.getByRole('heading', { name: 'Elegí tu contraseña' })
    ).toBeVisible();
  });

  test('rechaza una contraseña de menos de 6 caracteres', async ({ page }) => {
    // GIVEN: contraseña corta y su confirmación
    await page.getByLabel('Contraseña', { exact: true }).fill('123');
    await page.getByLabel('Confirmar contraseña').fill('123');

    // WHEN: intenta continuar
    await page.getByRole('button', { name: 'Continuar' }).click();

    // THEN: ve el error de longitud mínima
    await expect(
      page.getByText('La contraseña debe tener al menos 6 caracteres')
    ).toBeVisible();
  });

  test('muestra error cuando las contraseñas no coinciden', async ({ page }) => {
    // GIVEN: contraseña válida pero confirmación distinta
    await page.getByLabel('Contraseña', { exact: true }).fill('claveSegura1');
    await page.getByLabel('Confirmar contraseña').fill('otraClave2');

    // WHEN: intenta continuar
    await page.getByRole('button', { name: 'Continuar' }).click();

    // THEN: ve el error de coincidencia
    await expect(page.getByText('Las contraseñas no coinciden')).toBeVisible();
  });
});

test.describe('Registro — camino feliz hasta crear la cuenta', () => {
  test('completa los 3 pasos y muestra la pantalla de éxito (signup mockeado)', async ({
    page,
  }) => {
    // GIVEN: interceptamos el signup de Supabase para devolver éxito sin crear
    // una cuenta real. Devolvemos un objeto de usuario al estilo GoTrue.
    await page.route('**/auth/v1/signup**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000000',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'juan@uni.edu.ar',
          created_at: '2026-05-29T00:00:00.000Z',
          confirmed_at: null,
          app_metadata: {},
          user_metadata: {},
        }),
      });
    });

    await page.goto('/register');

    // WHEN: paso 1 — datos personales
    await page.getByLabel('Nombre completo').fill('Juan Pérez');
    await page.getByLabel('Email').fill('juan@uni.edu.ar');
    await page.getByRole('button', { name: 'Continuar' }).click();

    // WHEN: paso 2 — contraseña válida y confirmada
    await page.getByLabel('Contraseña', { exact: true }).fill('claveSegura1');
    await page.getByLabel('Confirmar contraseña').fill('claveSegura1');
    await page.getByRole('button', { name: 'Continuar' }).click();

    // WHEN: paso 3 — universidad y carrera, y crear la cuenta
    await expect(
      page.getByRole('heading', { name: '¿Dónde estudiás?' })
    ).toBeVisible();
    await page.getByLabel('Universidad').fill('UBA');
    await page.getByLabel('Carrera').fill('Ingeniería');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    // THEN: aparece la pantalla de éxito
    await expect(
      page.getByRole('heading', { name: '¡Cuenta creada!' })
    ).toBeVisible();
  });
});
