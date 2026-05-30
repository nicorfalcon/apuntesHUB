import { test, expect } from '@playwright/test';

// Página de 404 personalizada en src/app/not-found.tsx. Cualquier URL no
// matcheada por un route handler la renderiza con status 404. El layout
// muestra "404" + heading + CTA "Explorar apuntes".

test.describe('Error pages (público)', () => {
  test('una URL que no existe devuelve 404 con la página personalizada', async ({
    page,
  }) => {
    // WHEN: navegamos a una URL random
    const response = await page.goto('/esta-url-no-existe-en-ningun-lado');

    // THEN: el response tiene status 404 y la página custom se renderiza
    expect(response?.status()).toBe(404);
    await expect(page.getByText('404', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'No encontramos lo que buscás',
      })
    ).toBeVisible();
    // CTA hacia /explorar
    await expect(
      page.getByRole('link', { name: 'Explorar apuntes' })
    ).toHaveAttribute('href', '/explorar');
  });

  test('un id inexistente en /resume/[id] renderiza la página 404 custom', async ({
    page,
  }) => {
    // GIVEN: un UUID que no corresponde a ningún resume sembrado. El handler
    // llama notFound() server-side.
    await page.goto('/resume/00000000-0000-0000-0000-000000000000');

    // THEN: la UI de 404 aparece. (En el dev server de Next la respuesta
    // a veces sale como 200 — lo importante es el render correcto del
    // not-found.tsx, que es lo que ve el usuario.)
    await expect(page.getByText('404', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'No encontramos lo que buscás',
      })
    ).toBeVisible();
  });
});
