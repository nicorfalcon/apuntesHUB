/**
 * Helpers para manejar fechas y horas en la zona horaria de Argentina.
 *
 * ¿Por qué no usamos `new Date("YYYY-MM-DD")`?
 * --------------------------------------------------
 * En JavaScript, `new Date("2026-05-12")` asume que la fecha está en UTC (medianoche UTC).
 * Al convertirlo a la zona horaria de Argentina (UTC-3), esa misma fecha se convierte en
 * "2026-05-11 21:00:00", lo que provoca un desfase de un día completo al iterar días o
 * comparar fechas de calendario.
 *
 * Por eso, tratamos los días de calendario como strings puros ("YYYY-MM-DD") y solo
 * creamos objetos Date cuando necesitamos instantes reales de tiempo (con hora).
 */

const TZ = "America/Argentina/Buenos_Aires";

/** Obtener la fecha actual en Argentina como string YYYY-MM-DD */
export function getTodayYmd(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** Sumar o restar días a un string YYYY-MM-DD de forma segura */
export function addDaysYmd(ymd: string, days: number): string {
  // Usamos UTC a mediodía para sumar días de forma segura y evitar saltos por DST
  const date = new Date(`${ymd}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

/** Obtener el inicio de semana (lunes) para una fecha YYYY-MM-DD */
export function getWeekStartYmd(ymd: string): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  let day = date.getUTCDay(); // 0 = Sun, 1 = Mon
  if (day === 0) day = 7; // Convertir domingo (0) a 7 para que la semana empiece el lunes
  const diff = day - 1; // Días a restar para llegar al lunes
  return addDaysYmd(ymd, -diff);
}

/** Convertir un string "YYYY-MM-DD" y hora "HH:MM" a un Date real en Argentina */
export function timeToArgentinaDate(ymd: string, time: string): Date {
  // Argentina siempre es UTC-3 (sin DST desde 2009).
  // Normalizar hora (la BD puede devolver HH:MM:SS)
  const parts = time.split(":");
  const h = parts[0].padStart(2, "0");
  const m = parts[1].padStart(2, "0");
  const s = parts[2] ? parts[2].padStart(2, "0") : "00";

  // Instanciar usando offset estático -03:00 para asegurar exactitud
  return new Date(`${ymd}T${h}:${m}:${s}-03:00`);
}

/** Convertir un objeto Date a string YYYY-MM-DD en Argentina */
export function formatDateInArgentina(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** Obtener el día de la semana (0=Sun, 6=Sat) de un string YYYY-MM-DD */
export function getDayOfWeekYmd(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

/** Generar un array de fechas YYYY-MM-DD entre fromYmd y toYmd (inclusive) */
export function generateDateRangeYmd(fromYmd: string, toYmd: string): string[] {
  const dates: string[] = [];
  let current = fromYmd;
  // Comparación alfanumérica segura por formato YYYY-MM-DD
  while (current <= toYmd) {
    dates.push(current);
    current = addDaysYmd(current, 1);
  }
  return dates;
}

/** Obtener la hora local argentina formateada (HH:MM) */
export function formatTimeInArgentina(date: Date): string {
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TZ,
  });
}
