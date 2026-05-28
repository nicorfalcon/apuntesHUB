import { test, expect } from '@playwright/test';

// Grupo C — Validación de formularios (sin tocar el backend).
// El registro valida en el cliente (noValidate + lógica propia) y muestra
// mensajes de error visibles. El login tiene un toggle mostrar/ocultar
// contraseña. Todo esto es determinista: no manda nada al servidor.

test.describe('Registro — validación del primer paso', () => {
  test.beforeEach(async ({ page }) => {
    // GIVEN: el visitante abre el formulario de registro (paso "Creá tu cuenta").
    await page.goto('/register');
  });

  test('enviar el paso vacío muestra el error de nombre requerido', async ({
    page,
  }) => {
    // WHEN: hace clic en "Continuar" sin completar ningún campo.
    await page.getByRole('button', { name: 'Continuar' }).click();

    // THEN: aparece el mensaje de validación del nombre. getByText apunta al
    // texto visible, igual que lo leería un usuario.
    await expect(page.getByText('El nombre es requerido')).toBeVisible();
  });

  test('un email con formato inválido muestra su error', async ({ page }) => {
    // GIVEN: completa el nombre pero escribe un email mal formado.
    // getByLabel usa la etiqueta del campo: locator semántico y accesible.
    await page.getByLabel('Nombre completo').fill('Juan Pérez');
    await page.getByLabel('Email').fill('esto-no-es-un-email');

    // WHEN: intenta avanzar.
    await page.getByRole('button', { name: 'Continuar' }).click();

    // THEN: ve el error de formato de email.
    await expect(page.getByText('Ingresá un email válido')).toBeVisible();
  });
});

test.describe('Login — campo de contraseña', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('el botón mostrar/ocultar cambia la visibilidad de la contraseña', async ({
    page,
  }) => {
    // exact: true para no confundir el campo "Contraseña" con el botón cuyo
    // aria-label es "Mostrar contraseña" (ambos contienen la palabra).
    const password = page.getByLabel('Contraseña', { exact: true });

    // GIVEN: por defecto la contraseña está oculta (input de tipo "password").
    await expect(password).toHaveAttribute('type', 'password');

    // WHEN: hace clic en "Mostrar contraseña".
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();

    // THEN: el campo pasa a texto plano (visible).
    await expect(password).toHaveAttribute('type', 'text');

    // WHEN: vuelve a hacer clic, ahora en "Ocultar contraseña".
    await page.getByRole('button', { name: 'Ocultar contraseña' }).click();

    // THEN: el campo vuelve a ocultarse.
    await expect(password).toHaveAttribute('type', 'password');
  });
});
