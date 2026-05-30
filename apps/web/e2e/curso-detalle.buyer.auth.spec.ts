import { test, expect } from '@playwright/test';
import { E2E_UNENROLLED_COURSE_ID } from './support/seed';

// Flujo de inscripción en /cursos/[id] con buyer logueado:
//   1. La página renderiza el curso publicado sin inscripción y el botón
//      "Inscribirme" (si el buyer ya tuviera enrollment completed la página
//      mostraría "Ver curso" en su lugar, por eso usamos el curso sembrado
//      sin enrollment).
//   2. Al hacer click, el cliente llama a POST /api/courses/[id]/checkout.
//   3. Interceptamos esa llamada con page.route() para no crear preferencias
//      reales en MP. Devolvemos un initPoint dummy.
//   4. Bloqueamos la navegación al initPoint fake para que el browser no
//      intente cargarlo.

test.describe('Detalle de curso grabado (buyer)', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: el buyer abre el detalle del curso sembrado sin inscripción.
    await page.goto(`/cursos/${E2E_UNENROLLED_COURSE_ID}`);
  });

  test('muestra el título del curso y el botón Inscribirme', async ({ page }) => {
    // THEN: heading del curso (es el title del seed) y el botón habilitado.
    await expect(
      page.getByRole('heading', { name: 'Curso E2E sin inscribir' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Inscribirme' })
    ).toBeVisible();
  });

  test('al inscribirme dispara checkout y redirige al initPoint', async ({
    page,
  }) => {
    // GIVEN: mockeamos el endpoint de checkout del curso. La ruta incluye el
    // id en el path; matcheamos cualquiera con el glob.
    let capturedUrl: string | null = null;
    await page.route('**/api/courses/*/checkout', async (route) => {
      capturedUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enrollmentId: 'enr-e2e',
          preferenceId: 'mp-pref-course-e2e',
          initPoint: 'https://mock-mp.test/checkout/course/123',
        }),
      });
    });

    // GIVEN: bloqueamos la navegación al dominio fake de MP.
    await page.route('https://mock-mp.test/**', (route) => route.abort());

    // WHEN: click en "Inscribirme"
    await page.getByRole('button', { name: 'Inscribirme' }).click();

    // THEN: el endpoint del curso correcto fue llamado. El courseId va en el
    // path, no en el body (a diferencia de create-preference para resumes).
    await expect
      .poll(() => capturedUrl)
      .toContain(`/api/courses/${E2E_UNENROLLED_COURSE_ID}/checkout`);
  });
});
