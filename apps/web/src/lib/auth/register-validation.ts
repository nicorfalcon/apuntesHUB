/**
 * Validación por paso del formulario de registro multi-step (/register).
 *
 * Step 0: Datos personales (name + email).
 * Step 1: Contraseña + confirmación.
 * Step 2: Universidad + carrera.
 *
 * Devuelve un objeto con las llaves del FormData que tienen error y el mensaje
 * correspondiente. Un objeto vacío indica que el paso es válido.
 */

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  university: string;
  career: string;
}

export type RegisterStepErrors = Partial<Record<keyof RegisterFormData, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterStep(
  step: number,
  form: RegisterFormData
): RegisterStepErrors {
  const e: RegisterStepErrors = {};

  if (step === 0) {
    if (!form.name.trim()) e.name = "El nombre es requerido";
    if (!form.email.trim()) {
      e.email = "El email es requerido";
    } else if (!EMAIL_RE.test(form.email)) {
      e.email = "Ingresá un email válido";
    }
  } else if (step === 1) {
    if (!form.password) {
      e.password = "La contraseña es requerida";
    } else if (form.password.length < 6) {
      e.password = "La contraseña debe tener al menos 6 caracteres";
    }
    if (!form.confirmPassword) {
      e.confirmPassword = "Confirmá tu contraseña";
    } else if (form.password !== form.confirmPassword) {
      e.confirmPassword = "Las contraseñas no coinciden";
    }
  } else if (step === 2) {
    if (!form.university.trim()) e.university = "La universidad es requerida";
    if (!form.career.trim()) e.career = "La carrera es requerida";
  }

  return e;
}
