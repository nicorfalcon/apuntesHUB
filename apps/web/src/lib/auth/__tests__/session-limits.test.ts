import { describe, it, expect, afterEach, vi } from "vitest";

// MAX_DEVICES_PER_USER se calcula al IMPORTAR el módulo, leyendo
// process.env.MAX_DEVICES_PER_USER (dependencia externa: entorno). Como el
// valor queda "congelado" al importar, para probar distintos entornos hay que
// resetear el módulo y reimportarlo con la env stubeada en cada caso.
async function importMaxDevicesWith(envValue: string | undefined) {
  vi.resetModules();
  if (envValue === undefined) {
    vi.stubEnv("MAX_DEVICES_PER_USER", "");
    delete process.env.MAX_DEVICES_PER_USER;
  } else {
    vi.stubEnv("MAX_DEVICES_PER_USER", envValue);
  }
  const mod = await import("../session-limits");
  return mod.MAX_DEVICES_PER_USER;
}

describe("MAX_DEVICES_PER_USER", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("usa el valor del entorno cuando es un entero positivo", async () => {
    expect(await importMaxDevicesWith("5")).toBe(5);
  });

  it("cae al fallback (2) cuando la variable no está definida", async () => {
    expect(await importMaxDevicesWith(undefined)).toBe(2);
  });

  it("cae al fallback cuando el valor no es numérico", async () => {
    expect(await importMaxDevicesWith("abc")).toBe(2);
  });

  it("cae al fallback cuando el valor es cero o negativo", async () => {
    expect(await importMaxDevicesWith("0")).toBe(2);
    expect(await importMaxDevicesWith("-3")).toBe(2);
  });

  it("cae al fallback cuando el valor no es entero", async () => {
    expect(await importMaxDevicesWith("2.5")).toBe(2);
  });
});
