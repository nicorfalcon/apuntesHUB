import { test, expect } from '@playwright/test';
import { E2E_COURSE_ID, E2E_MODULE_ID } from './support/seed';

// Reproductor de curso en /cursos/[id]/ver/[moduleId] con buyer inscripto:
//   1. La página renderiza el módulo sembrado y el panel "Consultas del módulo".
//   2. El buyer abre el formulario y crea una consulta sobre el video.
//   3. Al publicar, el cliente hace POST /api/material-questions. Interceptamos
//      ese POST para no crear filas reales y verificamos que el payload usa la
//      variante CURSO (targetType: course, courseId, moduleId, anchorSeconds),
//      que es la que no cubría el spec de consulta sobre apuntes.
//
// El módulo sembrado no tiene video_storage_key, así que no se piden URLs a
// Backblaze: la página se monta sin video real, pero el panel funciona igual.

test.describe('Reproductor de curso y consulta del módulo (buyer)', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: el buyer abre el módulo del curso en el que está inscripto.
    await page.goto(`/cursos/${E2E_COURSE_ID}/ver/${E2E_MODULE_ID}`);
  });

  test('renderiza el módulo y el panel de consultas del módulo', async ({
    page,
  }) => {
    // THEN: el heading del módulo (título sembrado) y el panel de consultas.
    await expect(
      page.getByRole('heading', { name: 'Módulo 1 E2E' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Consultas del módulo' })
    ).toBeVisible();
  });

  test('al publicar una consulta dispara POST /api/material-questions en variante curso', async ({
    page,
  }) => {
    // GIVEN: interceptamos solo el POST (la creación). El GET del listado va al
    // backend real (no hay consultas de curso sembradas: devuelve vacío).
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
        body: JSON.stringify({ question: { id: 'mq-curso-e2e' } }),
      });
    });

    // WHEN: abre el formulario con el CTA del panel y completa la consulta.
    await page
      .getByRole('button', { name: 'Preguntar en este minuto' })
      .first()
      .click();
    await page.getByLabel('Título').fill('Duda sobre el minuto del video');
    await page
      .getByLabel('Detalle')
      .fill('¿Podés explicar de nuevo la parte que arranca en este momento?');
    await page.getByRole('button', { name: 'Publicar consulta' }).click();

    // THEN: el payload corresponde a un curso, anclado al módulo y al segundo 0
    // (el reproductor arranca en 0 sin progreso previo).
    await expect.poll(() => capturedBody).toMatchObject({
      targetType: 'course',
      courseId: E2E_COURSE_ID,
      moduleId: E2E_MODULE_ID,
      anchorSeconds: 0,
      title: 'Duda sobre el minuto del video',
      isAnonymousToBuyers: false,
    });
  });
});
