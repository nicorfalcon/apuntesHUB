import fs from "fs";
import path from "path";

/**
 * Carga `.env.local` en process.env si las variables no están seteadas.
 * Playwright corre en un proceso aparte de Next y NO carga automáticamente los
 * archivos .env del proyecto, por eso este helper. Sin deps (no agregamos
 * dotenv): un parser simple alcanza para el formato KEY=VALUE / # comentarios.
 */
export function loadDotEnvLocal(): void {
  const file = path.resolve(__dirname, "../../.env.local");
  if (!fs.existsSync(file)) return;

  const content = fs.readFileSync(file, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    // Quitar comillas envolventes si las hay.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
