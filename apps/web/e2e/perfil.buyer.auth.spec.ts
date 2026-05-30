import { test, expect } from '@playwright/test';
import { E2E_BUYER } from './support/seed';

// /profile del buyer. La página tiene tres secciones que nos interesan:
//   - ProfileForm con el display_name editable.
//   - "Dispositivos conectados" — lista cargada vía GET /api/auth/devices/list.
//   - "Sesiones activas" — botón para revocar todas las sesiones.
//
// No mutamos el perfil ni revocamos sesiones para mantener el seed estable
// entre corridas. Validamos rendering y que las secciones se montan.

test.describe('Perfil (buyer)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile');
  });

  test('renderiza el heading principal "Mi perfil"', async ({ page }) => {
    // THEN
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mi perfil' })
    ).toBeVisible();
  });

  test('el input de nombre público arranca con el display_name del buyer', async ({
    page,
  }) => {
    // THEN: el form precarga el nombre actual del buyer y el botón "Guardar
    // cambios" está habilitado (estado inicial del form).
    await expect(page.getByLabel('Nombre público')).toHaveValue(
      E2E_BUYER.fullName
    );
    await expect(
      page.getByRole('button', { name: 'Guardar cambios' })
    ).toBeEnabled();
  });

  test('la sección Seguridad muestra Dispositivos conectados y Sesiones activas', async ({
    page,
  }) => {
    // GIVEN: el shell del perfil tiene un sidebar de secciones. "Seguridad"
    // contiene los dos cards (dispositivos + sesiones).
    await page.getByRole('button', { name: /^Seguridad/ }).click();

    // THEN: ambos cards de seguridad se montan + la lista de dispositivos
    // termina de cargar (el login programático del globalSetup registra el
    // browser actual en user_devices).
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Dispositivos conectados',
      })
    ).toBeVisible();
    await expect(
      page.getByText('Cargando dispositivos...')
    ).toBeHidden();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Sesiones activas' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: 'Cerrar sesión en todos los dispositivos',
      })
    ).toBeVisible();
  });
});
