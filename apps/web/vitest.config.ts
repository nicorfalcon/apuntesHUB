import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // Plugin de React: necesario para parsear JSX en los *.test.tsx (Vitest usa Vite
  // por debajo). Inocuo para los tests Node existentes.
  plugins: [react()],
  test: {
    // Default: tests de lógica pura/Node. Los archivos *.test.tsx que necesiten
    // DOM lo activan archivo por archivo con la pragma:
    //     // @vitest-environment jsdom
    // (Vitest 4 sacó environmentMatchGlobs; la pragma por archivo es lo idiomático.)
    environment: "node",
    // Setup global de RTL (extiende expect con matchers de jest-dom). Solo
    // aplica efectos cuando el entorno es jsdom; en Node es inocuo.
    setupFiles: ["./src/test/setup-rtl.ts"],
    // Los tests e2e usan Playwright (otro runner). Vitest no debe tocarlos.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    coverage: {
      // Excluir código browser-only que jsdom no puede ejercitar de verdad.
      // client-hints.ts depende de `navigator.brave?.isBrave()` (API exclusiva
      // de Brave). En Vitest cualquier test sería mockear el stub y verificarlo
      // contra sí mismo. La cobertura real viene de Playwright en Chromium.
      exclude: [
        "src/lib/devices/client-hints.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
