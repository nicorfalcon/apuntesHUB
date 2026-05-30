/**
 * Score heurístico de fortaleza de contraseña.
 *
 * Suma 1 punto por cada criterio cumplido (longitud ≥6, longitud ≥10, mayúscula,
 * número, símbolo). Después agrupa el score en cuatro categorías visuales para
 * el medidor en `/register`. Vacío devuelve score 0 sin label.
 */
export interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: "Débil", color: "#DC2626" };
  if (score <= 2) return { score: 2, label: "Regular", color: "#F59E0B" };
  if (score <= 3) return { score: 3, label: "Buena", color: "#3B82F6" };
  return { score: 4, label: "Fuerte", color: "#2D6A4F" };
}
