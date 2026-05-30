import { describe, it, expect } from "vitest";
import {
  validateRegisterStep,
  type RegisterFormData,
} from "../register-validation";

function fullForm(overrides: Partial<RegisterFormData> = {}): RegisterFormData {
  return {
    name: "Juan",
    email: "juan@test.com",
    password: "secret-pass",
    confirmPassword: "secret-pass",
    university: "ITBA",
    career: "Bioingeniería",
    ...overrides,
  };
}

describe("validateRegisterStep — step 0 (datos personales)", () => {
  it("dado nombre y email válidos, entonces no devuelve errores", () => {
    expect(validateRegisterStep(0, fullForm())).toEqual({});
  });

  it("dado nombre vacío, entonces marca error en name", () => {
    expect(validateRegisterStep(0, fullForm({ name: "  " }))).toMatchObject({
      name: "El nombre es requerido",
    });
  });

  it("dado email vacío, entonces marca 'requerido' en email", () => {
    expect(validateRegisterStep(0, fullForm({ email: "" })).email).toBe(
      "El email es requerido"
    );
  });

  it("dado email con formato inválido, entonces marca 'email válido'", () => {
    expect(
      validateRegisterStep(0, fullForm({ email: "no-arroba" })).email
    ).toBe("Ingresá un email válido");
  });
});

describe("validateRegisterStep — step 1 (contraseña)", () => {
  it("dado contraseña y confirmación válidas y coincidentes, entonces no hay errores", () => {
    expect(validateRegisterStep(1, fullForm())).toEqual({});
  });

  it("dado contraseña vacía, entonces marca 'requerida'", () => {
    expect(validateRegisterStep(1, fullForm({ password: "" })).password).toBe(
      "La contraseña es requerida"
    );
  });

  it("dado contraseña de menos de 6 caracteres, entonces marca el largo mínimo", () => {
    expect(
      validateRegisterStep(1, fullForm({ password: "abc", confirmPassword: "abc" }))
        .password
    ).toMatch(/6 caracteres/);
  });

  it("dado confirmación vacía, entonces marca 'Confirmá tu contraseña'", () => {
    expect(
      validateRegisterStep(1, fullForm({ confirmPassword: "" })).confirmPassword
    ).toBe("Confirmá tu contraseña");
  });

  it("dado contraseñas que no coinciden, entonces marca el mismatch", () => {
    expect(
      validateRegisterStep(
        1,
        fullForm({ password: "abcdef", confirmPassword: "abcdeg" })
      ).confirmPassword
    ).toBe("Las contraseñas no coinciden");
  });
});

describe("validateRegisterStep — step 2 (universidad)", () => {
  it("dado universidad y carrera válidas, entonces no hay errores", () => {
    expect(validateRegisterStep(2, fullForm())).toEqual({});
  });

  it("dado universidad vacía, entonces marca error", () => {
    expect(
      validateRegisterStep(2, fullForm({ university: "   " })).university
    ).toBe("La universidad es requerida");
  });

  it("dado carrera vacía, entonces marca error", () => {
    expect(validateRegisterStep(2, fullForm({ career: "" })).career).toBe(
      "La carrera es requerida"
    );
  });
});

describe("validateRegisterStep — step fuera de rango", () => {
  it("dado un step desconocido (99), entonces no marca ningún error", () => {
    expect(validateRegisterStep(99, fullForm({ name: "", email: "" }))).toEqual({});
  });
});
