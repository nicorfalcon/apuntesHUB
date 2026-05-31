import { test, expect } from '@playwright/test';
import {
  E2E_UNENROLLED_COURSE_ID,
  E2E_UNENROLLED_MODULE_ID,
  E2E_UNPURCHASED_RESUME_ID,
} from './support/seed';

// Control de acceso (negativo) para un buyer logueado que intenta acceder a
// material que NO compró/no tiene inscripción. La sesión es válida, pero el gate
// por recurso (assertCourseModuleAccess / RPC get_resume_download_url) debe
// redirigir en vez de mostrar el contenido. Prueba que tener sesión no alcanza:
// hace falta la compra/inscripción concreta.

test.describe('Acceso del buyer a material ajeno', () => {
  test('ver un curso sin inscripción redirige al detalle del curso', async ({
    page,
  }) => {
    // GIVEN/WHEN: el buyer no está inscripto en este curso.
    await page.goto(
      `/cursos/${E2E_UNENROLLED_COURSE_ID}/ver/${E2E_UNENROLLED_MODULE_ID}`
    );

    // THEN: no entra al reproductor; queda en la landing del curso.
    await expect(page).toHaveURL(
      new RegExp(`/cursos/${E2E_UNENROLLED_COURSE_ID}$`)
    );
  });

  test('ver un apunte no comprado redirige a la biblioteca', async ({
    page,
  }) => {
    // GIVEN/WHEN: el buyer no compró este apunte.
    await page.goto(`/my-purchases/${E2E_UNPURCHASED_RESUME_ID}/view`);

    // THEN: el RPC de validación falla y lo manda a /my-purchases.
    await expect(page).toHaveURL(/\/my-purchases$/);
  });
});
