import type { Page } from '@playwright/test';

export async function waitForHydration(page: Page) {
  await page.locator('html[data-e2e-hydrated="true"]').waitFor();
}

export async function gotoHydrated(page: Page, url: string) {
  await page.goto(url);
  await waitForHydration(page);
}
