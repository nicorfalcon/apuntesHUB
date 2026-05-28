import { test, expect } from '@playwright/test';

// Grupo B — Buscador y filtros en /explorar (sin login).
// Estos tests verifican el COMPORTAMIENTO de la interfaz (que reacciona bien),
// no datos puntuales de la base. Así son deterministas: dan el mismo resultado
// siempre, sin depender de qué apuntes estén publicados.

test.describe('Buscador de apuntes en explorar', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: el visitante abre la página de explorar (pestaña "Apuntes" por defecto).
    await page.goto('/explorar');
  });

  test('el buscador de apuntes está visible', async ({ page }) => {
    // THEN: el campo de búsqueda (un <input type="search">, rol "searchbox")
    // está a la vista. getByRole es un locator semántico, no atado a clases CSS.
    await expect(page.getByRole('searchbox')).toBeVisible();
  });

  test('al escribir aparece el botón Limpiar y al usarlo se vacía el buscador', async ({
    page,
  }) => {
    const buscador = page.getByRole('searchbox');
    // exact: true para que "Limpiar" no coincida con el botón "Limpiar filtros"
    // del estado vacío. Sin esto, el match por substring agarraría el botón
    // equivocado.
    const limpiar = page.getByRole('button', { name: 'Limpiar', exact: true });

    // GIVEN: sin texto, el botón "Limpiar" no está en la página.
    await expect(limpiar).toBeHidden();

    // WHEN: el visitante escribe en el buscador.
    await buscador.fill('algebra');

    // THEN: el botón "Limpiar" aparece. Playwright lo espera solo (auto-wait):
    // no hace falta ningún sleep ni waitForTimeout.
    await expect(limpiar).toBeVisible();

    // WHEN: hace clic en "Limpiar".
    await limpiar.click();

    // THEN: el buscador queda vacío.
    await expect(buscador).toHaveValue('');
  });

  test('el toggle "Buscar por tema" cambia el modo y el placeholder', async ({
    page,
  }) => {
    const toggle = page.getByRole('switch', { name: 'Buscar por tema' });
    const buscador = page.getByRole('searchbox');

    // GIVEN: el modo "Buscar por tema" arranca desactivado.
    await expect(toggle).not.toBeChecked();

    // WHEN: el visitante activa el toggle.
    await toggle.click();

    // THEN: el toggle queda activado y el placeholder del buscador cambia al
    // del modo por tema. El cambio es reactivo y Playwright espera a que ocurra.
    await expect(toggle).toBeChecked();
    await expect(buscador).toHaveAttribute('placeholder', /Le Chatelier/);
  });
});

test.describe('Pestañas del catálogo en explorar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explorar');
  });

  test('cambiar a "Profesores particulares" marca esa pestaña como activa', async ({
    page,
  }) => {
    const tabParticulares = page.getByRole('tab', {
      name: 'Profesores particulares',
    });

    // WHEN: el visitante hace clic en la pestaña de profesores particulares.
    await tabParticulares.click();

    // THEN: esa pestaña queda seleccionada (aria-selected) y la URL refleja el
    // cambio de vertical. Verificar ambos cubre la UI y la navegación.
    await expect(tabParticulares).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/tab=particulares/);
  });
});
