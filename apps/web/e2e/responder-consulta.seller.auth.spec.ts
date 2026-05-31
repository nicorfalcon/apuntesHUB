import { test, expect } from '@playwright/test';
import {
  E2E_MATERIAL_QUESTION_ID,
  E2E_MATERIAL_QUESTION_TITLE,
} from './support/seed';

// El otro lado del ciclo pregunta->respuesta: el vendedor responde una consulta
// desde el manager del dashboard (tab Consultas). La consulta sembrada es del
// buyer sobre el apunte del seller, así que el seller la ve y puede responderla.
//   1. El seller abre /sell/dashboard y va al tab Consultas.
//   2. Aparece la consulta sembrada con su composer "Respuesta oficial" inline.
//   3. Escribe y publica -> POST /api/material-questions/[id]/answers.
//   4. Interceptamos ese POST para no crear filas reales y verificamos el
//      payload y que apunta a la consulta correcta.

test.describe('Responder consulta (seller)', () => {
  test('el seller responde la consulta sembrada desde el dashboard', async ({
    page,
  }) => {
    // GIVEN: interceptamos el POST de la respuesta.
    let capturedBody: Record<string, unknown> | null = null;
    let capturedUrl = '';
    await page.route(
      '**/api/material-questions/*/answers',
      async (route) => {
        capturedUrl = route.request().url();
        capturedBody = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ answer: { id: 'ans-e2e' } }),
        });
      }
    );

    // GIVEN: el seller abre el panel y va al tab Consultas.
    await page.goto('/sell/dashboard');
    await page.getByRole('button', { name: /Consultas/ }).click();

    // THEN: la consulta sembrada aparece.
    await expect(
      page.getByRole('heading', { name: E2E_MATERIAL_QUESTION_TITLE })
    ).toBeVisible();

    // WHEN: escribe la respuesta en el composer de ESA consulta (scope por id)
    // y publica.
    const textarea = page.locator(
      `#material-answer-${E2E_MATERIAL_QUESTION_ID}`
    );
    await textarea.fill('Claro, el ejercicio se resuelve aplicando el teorema visto en clase.');
    const form = page.locator('form', { has: textarea });
    await form.getByRole('button', { name: 'Responder' }).click();

    // THEN: el endpoint recibió el cuerpo y apunta a la consulta sembrada.
    await expect.poll(() => capturedBody).toMatchObject({
      body: 'Claro, el ejercicio se resuelve aplicando el teorema visto en clase.',
    });
    expect(capturedUrl).toContain(
      `/api/material-questions/${E2E_MATERIAL_QUESTION_ID}/answers`
    );
  });
});
