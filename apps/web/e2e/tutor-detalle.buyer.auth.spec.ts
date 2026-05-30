import { test, expect } from '@playwright/test';
import { E2E_SELLER } from './support/seed';

// Perfil público del tutor en /tutores/[id]. Como el seller_id no es una
// constante (lo crea auth.admin.createUser), llegamos al perfil clickeando
// el link "Ver perfil" del card del catálogo. Eso prueba además que la
// navegación entre catálogo y perfil funciona end-to-end.
//
// No exploramos el motor de slots: depende del "now" real y elegir un slot
// concreto haría el spec frágil. Validamos que la página renderiza y que el
// CTA de reserva está presente.

test.describe('Perfil del tutor (buyer)', () => {
  test('navega desde el catálogo al perfil y muestra el CTA Reservar clase', async ({
    page,
  }) => {
    // GIVEN: el buyer abre el catálogo de profesores y busca al seller.
    await page.goto('/explorar?tab=particulares');
    const card = page
      .getByRole('article')
      .filter({ hasText: E2E_SELLER.fullName });

    // WHEN: hace click en "Ver perfil" dentro del card.
    await card.getByRole('link', { name: 'Ver perfil' }).click();

    // THEN: la URL queda en /tutores/<sellerId>, el heading es el
    // display_name y el CTA "Reservar clase con ..." está visible.
    await expect(page).toHaveURL(/\/tutores\/[0-9a-f-]+$/);
    await expect(
      page.getByRole('heading', { level: 1, name: E2E_SELLER.fullName })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Reservar clase', exact: true })
    ).toBeVisible();
  });
});
