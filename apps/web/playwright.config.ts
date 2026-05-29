import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const BUYER_STORAGE = path.resolve(__dirname, 'e2e/.auth/buyer.json');
const SELLER_STORAGE = path.resolve(__dirname, 'e2e/.auth/seller.json');

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  // GlobalSetup: siembra usuarios de prueba en Supabase y guarda sus storageState
  // antes de correr la suite. Ver e2e/global-setup.ts.
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retries: 2 en CI; 1 en local para absorber la flakiness conocida del dev
     server de Next bajo HMR cuando varios workers atacan la misma ruta a la vez
     (síntoma típico: "Cannot read properties of null (reading 'useContext')"
     en usePathname). En CI no pasa porque ahí no hay HMR. */
  retries: process.env.CI ? 2 : 1,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* URL base: nos deja escribir page.goto('/login') en vez de la URL completa. */
    baseURL: 'http://localhost:3000',

    /* Guarda la "traza" (línea de tiempo navegable) solo al reintentar un test fallido. */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Proyecto público: sin storageState, ignora los specs auth-gated.
      testIgnore: ['**/*.auth.spec.ts'],
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: ['**/*.auth.spec.ts'],
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: ['**/*.auth.spec.ts'],
    },

    // Proyectos auth-gated: solo corren los specs *.auth.spec.ts con la sesión
    // del buyer o el seller persistida por el globalSetup.
    {
      name: 'chromium-buyer',
      use: { ...devices['Desktop Chrome'], storageState: BUYER_STORAGE },
      testMatch: ['**/*.buyer.auth.spec.ts'],
    },
    {
      name: 'chromium-seller',
      use: { ...devices['Desktop Chrome'], storageState: SELLER_STORAGE },
      testMatch: ['**/*.seller.auth.spec.ts'],
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Antes de correr los tests, Playwright levanta el dev server de Next y lo apaga al terminar.
     Así no hay que arrancarlo a mano: el comando `npx playwright test` se basta solo. */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    // Si ya tenés el dev corriendo, lo reutiliza (en local). En CI siempre arranca uno limpio.
    reuseExistingServer: !process.env.CI,
    // Next en dev puede tardar en el primer arranque; le damos margen para evitar timeouts falsos.
    timeout: 120 * 1000,
  },
});
