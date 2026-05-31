import { test, expect } from '@playwright/test';
import { E2E_SELLER, E2E_SUBJECT_ID } from './support/seed';

// Flujo de reserva de tutoría desde el perfil del tutor, con buyer logueado:
//   1. El buyer llega al perfil del tutor desde el catálogo y abre el diálogo
//      "Reservar clase".
//   2. El picker de horarios hace POST /api/tutors/available-slots. Lo mockeamos
//      con un único horario "hoy 18:00 ART" para que el test sea determinístico
//      (el motor real de slots depende del "now" y de la disponibilidad sembrada,
//      lo que lo haría frágil).
//   3. El buyer elige ese horario y confirma con "Reservar y pagar", que dispara
//      POST /api/mercadopago/create-tutoring-preference.
//   4. Interceptamos ese POST para no crear preferencias/bookings reales y
//      verificamos que el payload lleva tutor, materia, horario y duración.

// Horario ancla: hoy a las 18:00 hora Argentina (UTC-3 fijo, sin DST). El picker
// agrupa los slots por fecha ART y hoy siempre cae dentro de la semana visible,
// así que este slot queda en el día activo por defecto y se ve sin navegar.
const artToday = new Date().toLocaleDateString('sv-SE', {
  timeZone: 'America/Argentina/Buenos_Aires',
});
const SLOT_START = `${artToday}T18:00:00.000-03:00`;
const SLOT_END = `${artToday}T19:00:00.000-03:00`;

async function gotoTutorProfile(page: import('@playwright/test').Page) {
  await page.goto('/explorar?tab=particulares');
  const card = page
    .getByRole('article')
    .filter({ hasText: E2E_SELLER.fullName });
  await card.getByRole('link', { name: 'Ver perfil' }).click();
  await expect(page).toHaveURL(/\/tutores\/[0-9a-f-]+$/);
}

test.describe('Reserva de tutoría (buyer)', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: mockeamos el motor de slots con un único horario disponible hoy.
    await page.route('**/api/tutors/available-slots', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          slots: [
            { start: SLOT_START, end: SLOT_END, day_of_week: 1 },
          ],
        }),
      });
    });

    // GIVEN: el buyer abre el perfil del tutor desde el catálogo.
    await gotoTutorProfile(page);
  });

  test('abre el diálogo y muestra el horario disponible mockeado', async ({
    page,
  }) => {
    // WHEN: abre el diálogo de reserva.
    await page.getByRole('button', { name: 'Reservar clase', exact: true }).click();

    // THEN: el modal aparece y el picker muestra el horario de las 18:00.
    await expect(
      page.getByRole('heading', { name: /Reservar clase con/ })
    ).toBeVisible();
    const slotsSection = page
      .locator('section')
      .filter({ hasText: 'Horarios para' });
    await expect(
      slotsSection.getByRole('button', { name: '18:00' })
    ).toBeVisible();
  });

  test('al elegir un horario y confirmar, dispara create-tutoring-preference con el payload correcto', async ({
    page,
  }) => {
    // GIVEN: mockeamos la creación de la preferencia (no creamos booking real) y
    // capturamos el body para verificarlo.
    let capturedBody: Record<string, unknown> | null = null;
    await page.route(
      '**/api/mercadopago/create-tutoring-preference',
      async (route) => {
        capturedBody = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            preferenceId: 'mp-tutoria-e2e',
            initPoint: 'https://mock-mp.test/checkout/tutoria',
          }),
        });
      }
    );
    // GIVEN: bloqueamos la navegación al dominio fake de MP.
    await page.route('https://mock-mp.test/**', (route) => route.abort());

    // WHEN: abre el diálogo, elige el horario y confirma.
    await page.getByRole('button', { name: 'Reservar clase', exact: true }).click();
    const slotsSection = page
      .locator('section')
      .filter({ hasText: 'Horarios para' });
    await slotsSection.getByRole('button', { name: '18:00' }).click();
    await page.getByRole('button', { name: 'Reservar y pagar' }).click();

    // THEN: el endpoint recibió la reserva con la materia sembrada, el horario
    // elegido, la duración por defecto (60') y la modalidad online.
    await expect.poll(() => capturedBody).toMatchObject({
      subject_id: E2E_SUBJECT_ID,
      scheduled_at: SLOT_START,
      duration_minutes: 60,
      modality: 'online',
    });
    // El tutor_id es el sellerId real (no constante): basta con que viaje un uuid.
    expect((capturedBody as Record<string, unknown>)?.tutor_id).toMatch(
      /^[0-9a-f-]{36}$/
    );
  });
});
