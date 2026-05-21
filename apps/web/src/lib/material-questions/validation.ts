const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const MAX_LINES = 80;

export function normalizeMaterialQuestionText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function validateMaterialQuestionText(
  value: unknown,
  min: number,
  max: number,
  label: string
) {
  if (typeof value !== "string") {
    return { value: "", error: `${label} requerido.` };
  }

  const normalized = normalizeMaterialQuestionText(value);
  if (normalized.length < min || normalized.length > max) {
    return {
      value: normalized,
      error: `${label} debe tener entre ${min} y ${max} caracteres.`,
    };
  }

  if (normalized.split("\n").length > MAX_LINES) {
    return {
      value: normalized,
      error: `${label} tiene demasiados saltos de línea.`,
    };
  }

  return { value: normalized, error: null };
}
