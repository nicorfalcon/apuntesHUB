import { test, expect } from '@playwright/test';
import { E2E_RESUME_ID } from './support/seed';

// Flujo de "crear consulta" desde el viewer del apunte comprado, con buyer
// logueado:
//   1. El buyer abre /my-purchases/[resumeId]/view (tiene la compra sembrada).
//   2. En el panel lateral cambia a la pestaña "Consultas".
//   3. Abre el formulario con el CTA y completa título + detalle.
//   4. Al publicar, el cliente hace POST /api/material-questions.
//   5. Interceptamos ese POST con page.route() para no crear filas reales y
//      verificamos que el payload lleva el resumeId y la página ancla correctos.
//
// El GET inicial del panel (listado de consultas) se deja pasar al backend
// real: la query sembrada existe y no nos interesa mockear la lectura.

test.describe('Crear consulta sobre un apunte (buyer)', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: el buyer abre el visor del apunte que ya compró.
    await page.goto(`/my-purchases/${E2E_RESUME_ID}/view`);
  });

  test('el panel lateral expone la pestaña Consultas y su CTA', async ({
    page,
  }) => {
    // WHEN: cambia a la pestaña "Consultas" del panel lateral.
    await page.getByRole('button', { name: 'Consultas', exact: true }).click();

    // THEN: aparece el encabezado del panel y el CTA para preguntar.
    await expect(
      page.getByRole('heading', { name: 'Consultas' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Preguntar sobre esta página' }).first()
    ).toBeVisible();
  });

  test('al publicar una consulta dispara POST /api/material-questions con el resumeId y la página', async ({
    page,
  }) => {
    // GIVEN: interceptamos solo el POST (la creación). El GET del listado sigue
    // yendo al backend real para no romper la carga inicial del panel.
    let capturedBody: Record<string, unknown> | null = null;
    await page.route('**/api/material-questions', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      capturedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          question: { id: 'mq-e2e-creada' },
        }),
      });
    });

    // WHEN: abre la pestaña Consultas y despliega el formulario.
    await page.getByRole('button', { name: 'Consultas', exact: true }).click();
    await page
      .getByRole('button', { name: 'Preguntar sobre esta página' })
      .first()
      .click();

    // WHEN: completa título (>=8 chars) y detalle (>=10 chars) y publica.
    await page
      .getByLabel('Título')
      .fill('Duda sobre el ejercicio 3');
    await page
      .getByLabel('Detalle')
      .fill('No entiendo cómo se deduce el resultado del paso intermedio.');
    await page.getByRole('button', { name: 'Publicar consulta' }).click();

    // THEN: el endpoint recibió el payload esperado para un apunte (resume),
    // anclado a la página 1 (el PDF arranca en la primera página).
    await expect.poll(() => capturedBody).toMatchObject({
      targetType: 'resume',
      resumeId: E2E_RESUME_ID,
      anchorPage: 1,
      title: 'Duda sobre el ejercicio 3',
      body: 'No entiendo cómo se deduce el resultado del paso intermedio.',
      isAnonymousToBuyers: false,
    });
  });
});
