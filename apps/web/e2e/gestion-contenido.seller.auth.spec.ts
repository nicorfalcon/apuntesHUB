import { test, expect } from '@playwright/test';
import { E2E_UNPURCHASED_RESUME_ID } from './support/seed';

// Gestión de contenido del vendedor. Cubrimos dos cosas testeables sin pelear
// con uploads de archivos ni mutar datos sembrados:
//   1. El punto de entrada de creación (/sell/new) renderiza el selector de tipo.
//   2. El form de renombrar un apunte (/sell/[id]/rename) carga precargado,
//      valida en cliente y, al guardar, redirige al dashboard.
//
// El submit del rename reenvía el MISMO título (no-op real): así ejercitamos el
// camino feliz hasta la redirección sin alterar el dato que otros specs asumen.

const RESUME_TITLE = 'Apunte E2E sin comprar';

test.describe('Gestión de contenido (seller)', () => {
  test('/sell/new muestra el selector de qué publicar', async ({ page }) => {
    await page.goto('/sell/new');

    await expect(
      page.getByRole('heading', { level: 1, name: '¿Qué querés publicar?' })
    ).toBeVisible();
    // El section de tipos (apunte / curso) está rotulado para accesibilidad.
    await expect(
      page.getByRole('region', { name: 'Tipo de publicación' })
    ).toBeVisible();
  });

  test('/sell/[id]/rename precarga el título y valida el campo vacío', async ({
    page,
  }) => {
    await page.goto(`/sell/${E2E_UNPURCHASED_RESUME_ID}/rename`);

    // THEN: el input arranca con el título actual del apunte.
    const input = page.getByLabel('Nombre del apunte');
    await expect(input).toHaveValue(RESUME_TITLE);

    // WHEN/THEN: al vaciarlo, "Guardar cambios" queda deshabilitado.
    await input.fill('');
    await expect(
      page.getByRole('button', { name: 'Guardar cambios' })
    ).toBeDisabled();
  });

  test('/sell/[id]/rename guarda y redirige al dashboard', async ({ page }) => {
    await page.goto(`/sell/${E2E_UNPURCHASED_RESUME_ID}/rename`);

    const input = page.getByLabel('Nombre del apunte');
    await expect(input).toHaveValue(RESUME_TITLE);

    // WHEN: reenvía el mismo título (update no-op) y guarda.
    await input.fill(RESUME_TITLE);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    // THEN: vuelve al panel de ventas.
    await expect(page).toHaveURL(/\/sell\/dashboard$/);
  });
});
