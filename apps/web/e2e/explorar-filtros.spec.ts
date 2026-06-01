import { test, expect } from '@playwright/test';
import { gotoHydrated } from './support/hydration';

// Exploración del catálogo en /explorar. Estos tests verifican el comportamiento
// de la interfaz (pestañas, estado vacío, buscador), no datos puntuales. La base
// está vacía, así que el estado "sin resultados" es determinístico.

test.describe('Catálogo en explorar', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: el visitante abre explorar (pestaña "Apuntes" por defecto).
    await gotoHydrated(page, '/explorar');
  });

  test('abre en la pestaña Apuntes con el buscador visible', async ({ page }) => {
    // THEN: por defecto la vertical activa es "Apuntes" y el buscador está a la
    // vista. Es una verificación independiente de los datos publicados.
    await expect(page.getByRole('tab', { name: 'Apuntes' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByRole('searchbox')).toBeVisible();
  });

  test('cambiar a "Profesores particulares" actualiza la pestaña y la URL', async ({
    page,
  }) => {
    const tab = page.getByRole('tab', { name: 'Profesores particulares' });

    // WHEN: el visitante cambia de vertical
    await tab.click();

    // THEN: la pestaña queda seleccionada y la URL refleja el cambio
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/tab=particulares/);
  });

  test('cambiar a "Grabadas" actualiza la pestaña y la URL', async ({ page }) => {
    const tab = page.getByRole('tab', { name: 'Grabadas' });

    // WHEN
    await tab.click();

    // THEN
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/tab=grabadas/);
  });

  test('el buscador filtra por título y el botón Limpiar lo vacía', async ({
    page,
  }) => {
    const buscador = page.getByRole('searchbox');
    // exact:true para no agarrar "Limpiar filtros" del estado vacío.
    const limpiar = page.getByRole('button', { name: 'Limpiar', exact: true });

    // GIVEN: sin texto, el botón "Limpiar" del buscador no está
    await expect(limpiar).toBeHidden();

    // WHEN: escribe en el buscador
    await buscador.fill('algebra');

    // THEN: aparece "Limpiar" (auto-wait, sin sleeps)
    await expect(limpiar).toBeVisible();

    // WHEN: hace clic en "Limpiar"
    await limpiar.click();

    // THEN: el buscador queda vacío
    await expect(buscador).toHaveValue('');
  });
});
