// Normalizacion/validacion de "Temas del apunte" (resumes.topics).
//
// Los temas los declara el vendedor para mejorar el recall de la busqueda
// publica (Meilisearch + fallback Postgres). Este helper es PURO y se usa tanto
// en cliente (formulario) como en server (al construir el documento indexable o
// validar en un futuro endpoint), por eso no importa nada de Next/Supabase.
//
// Reglas (ver normalizeResumeTopic / normalizeResumeTopics):
//   - trim + colapsar espacios internos;
//   - quitar caracteres de control y etiquetas HTML/script;
//   - preservar acentos en el VALOR mostrado (la tolerancia a typos/acentos se
//     resuelve despues en Meilisearch y en el scoring del browse);
//   - dedupe case-insensitive y accent-insensitive (gana la primera aparicion);
//   - largo: minimo 2, maximo 60 caracteres por tema;
//   - maximo 30 temas por apunte;
//   - se preserva el orden en que el usuario los cargo.

export const MAX_RESUME_TOPICS = 30;
export const MAX_RESUME_TOPIC_LENGTH = 60;
export const MIN_RESUME_TOPIC_LENGTH = 2;

// Clave de comparacion: minusculas, sin acentos, sin espacios redundantes. Solo
// para deduplicar/comparar, NUNCA es el valor que se guarda/muestra.
export function resumeTopicKey(topic: string): string {
  return topic
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Normaliza un tema individual y devuelve "" si no es valido (muy corto/largo o
 * vacio tras limpiar). NO recorta a 60 caracteres: un tema demasiado largo se
 * considera invalido y se descarta, para no guardar un texto truncado raro.
 */
export function normalizeResumeTopic(topic: string): string {
  if (typeof topic !== "string") return "";

  const cleaned = topic
    // Quitar etiquetas HTML/script (defensa basica anti-inyeccion en el indice/UI).
    .replace(/<[^>]*>/g, " ")
    // Quitar caracteres de control (incluye \n, \t, etc.).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    // Colapsar cualquier secuencia de espacios en uno solo.
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < MIN_RESUME_TOPIC_LENGTH) return "";
  if (cleaned.length > MAX_RESUME_TOPIC_LENGTH) return "";

  return cleaned;
}

/**
 * Normaliza una lista de temas: limpia cada uno, descarta invalidos, deduplica
 * (case/accent-insensitive, gana el primero) y acota a {@link MAX_RESUME_TOPICS}.
 * Preserva el orden del usuario. Robusto ante entradas no-array.
 */
export function normalizeResumeTopics(topics: unknown): string[] {
  if (!Array.isArray(topics)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of topics) {
    const normalized = normalizeResumeTopic(typeof raw === "string" ? raw : "");
    if (!normalized) continue;

    const key = resumeTopicKey(normalized);
    if (key.length === 0 || seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);

    if (result.length >= MAX_RESUME_TOPICS) break;
  }

  return result;
}
