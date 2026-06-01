import { test, expect } from '@playwright/test';
import { gotoHydrated } from './support/hydration';

// Grupo D — Login real end-to-end (camino negativo).
// A diferencia de A/B/C, este test SÍ toca el backend: al enviar el formulario
// se llama a /api/auth/login, que consulta a Supabase y devuelve el error.
// Usamos credenciales inexistentes a propósito, así no necesita ninguna cuenta
// real ni secretos, y el resultado es siempre el mismo (determinista).

test.describe('Login — credenciales inválidas', () => {
  test('muestra un mensaje de error cuando las credenciales no existen', async ({
    page,
  }) => {
    // GIVEN: el visitante abre la página de inicio de sesión.
    await gotoHydrated(page, '/login');

    // WHEN: completa el formulario con credenciales que no existen y envía.
    // exact: true en "Contraseña" para no agarrar el botón "Mostrar contraseña".
    await page.getByLabel('Email').fill('noexiste@ejemplo.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('claveincorrecta');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    // THEN: aparece el mensaje de error que devuelve el backend.
    // La respuesta es asíncrona (fetch a la API + Supabase): el auto-wait de
    // Playwright espera solo a que el mensaje sea visible, sin sleep ni timeout.
    await expect(
      page.getByText('Email o contraseña incorrectos.')
    ).toBeVisible();

    // Y como el login falló, el visitante sigue en /login (no entró a la app).
    await expect(page).toHaveURL(/\/login$/);
  });
});
