import { test, expect } from '@playwright/test';
import { E2E_TUTOR_BOOKING_ID, E2E_SELLER } from './support/seed';

// Páginas de resultado del checkout de tutoría, con buyer logueado. Cierran el
// loop de la reserva (reserva -> pago -> resultado). Usamos el booking sembrado
// (status "confirmed"), que pertenece al buyer, así no dependemos de crear uno.

test.describe('Checkout de tutoría (buyer)', () => {
  test('success: muestra "Clase reservada" con los detalles del booking confirmado', async ({
    page,
  }) => {
    // GIVEN/WHEN: el buyer cae en la página de éxito con su booking confirmado.
    await page.goto(
      `/checkout/clase/success?booking_id=${E2E_TUTOR_BOOKING_ID}`
    );

    // THEN: como el booking ya está "confirmed", el poller muestra el estado
    // final sin pollear, con el nombre del profesor sembrado.
    await expect(
      page.getByRole('heading', { name: 'Clase reservada' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Detalles de la clase' })
    ).toBeVisible();
    await expect(page.getByText(E2E_SELLER.fullName)).toBeVisible();
  });

  test('success: sin booking_id redirige a explorar profesores', async ({
    page,
  }) => {
    // GIVEN/WHEN: falta el booking_id en la query.
    await page.goto('/checkout/clase/success');

    // THEN: el server redirige al catálogo de profesores particulares.
    await expect(page).toHaveURL(/\/explorar\?tab=particulares$/);
  });

  test('failure: muestra el mensaje de pago no completado y el link al profesor', async ({
    page,
  }) => {
    // GIVEN/WHEN: el buyer cae en la página de fallo con su booking.
    await page.goto(
      `/checkout/clase/failure?booking_id=${E2E_TUTOR_BOOKING_ID}`
    );

    // THEN: mensaje de error y, como el booking le pertenece, el link de vuelta
    // al perfil del profesor (se resolvió el tutorId).
    await expect(
      page.getByRole('heading', { name: 'El pago no se completó' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Volver al perfil del profesor' })
    ).toBeVisible();
  });
});
