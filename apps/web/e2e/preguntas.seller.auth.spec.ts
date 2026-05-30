import { test, expect } from '@playwright/test';
import {
  E2E_BUYER,
  E2E_MATERIAL_QUESTION_BODY,
  E2E_MATERIAL_QUESTION_TITLE,
} from './support/seed';

// /sell/dashboard tab "Consultas" del seller. La query del dashboard une
// material_questions por resume_id en los resúmenes del seller, así que la
// consulta sembrada del buyer aparece en el OwnerMaterialQuestionsManager
// con title + body + nombre del alumno. Cubre la integración seed → query
// del page → render del manager.

test.describe('Consultas recibidas (seller)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sell/dashboard');
    await page.getByRole('button', { name: /Consultas/ }).click();
  });

  test('muestra la consulta sembrada del buyer con título y cuerpo', async ({
    page,
  }) => {
    // THEN: el h3 del card es el título; el body aparece como párrafo.
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: E2E_MATERIAL_QUESTION_TITLE,
      })
    ).toBeVisible();
    await expect(page.getByText(E2E_MATERIAL_QUESTION_BODY)).toBeVisible();
  });

  test('asocia la consulta al alumno y al apunte sembrado', async ({ page }) => {
    // THEN: aparece el nombre del buyer (no anónimo) y el título del resume.
    await expect(page.getByText(E2E_BUYER.fullName)).toBeVisible();
    await expect(page.getByText('Apunte E2E de prueba')).toBeVisible();
  });
});
