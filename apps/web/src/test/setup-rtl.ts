// Extiende `expect` con los matchers de jest-dom (toBeVisible, toHaveAttribute, etc.)
// para los tests que corren bajo el entorno jsdom.
import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// RTL no auto-registra cleanup cuando `globals: false` en vitest. Lo hacemos
// explícito acá para que cada test arranque con un DOM limpio.
afterEach(() => {
  cleanup();
});
