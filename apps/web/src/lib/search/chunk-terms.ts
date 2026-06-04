// Derivación de "chunkTerms": términos/frases cortas y útiles extraídas del
// contenido de los chunks de un apunte, para usar SOLO como señal de búsqueda
// en Meilisearch.
//
// IMPORTANTE (seguridad/privacidad):
//   - chunkTerms NO es contenido visible del apunte: es una lista acotada de
//     términos para mejorar el recall de la búsqueda pública.
//   - NO guardamos párrafos completos ni snippets largos: cada término tiene un
//     largo máximo y la cantidad total está acotada.
//   - El llamador no debe exponer estos términos como "contenido del PDF" en la
//     UI salvo decisión explícita posterior.
//
// La función es pura y robusta: ante cualquier entrada vacía/rara devuelve [].

export const MAX_CHUNK_TERMS = 50;
export const MAX_CHUNK_TERM_LENGTH = 80;

// Tope de caracteres a procesar en total, para acotar el trabajo en apuntes muy
// grandes. No afecta seguridad: solo limita cuánto texto se analiza.
const MAX_TOTAL_CHARS = 250_000;

// Largo de las frases candidatas (en palabras). 2..4 captura conceptos como
// "le chatelier", "equilibrio quimico" o "principio de le chatelier".
const MIN_PHRASE_WORDS = 2;
const MAX_PHRASE_WORDS = 4;

// Largo mínimo de un token "de contenido" (no stopword, no genérico).
const MIN_CONTENT_TOKEN_LENGTH = 4;

// Stopwords del español + términos demasiado genéricos del dominio académico.
// Un término formado SOLO por estos no aporta señal y se descarta.
const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "un", "una", "uno", "unos", "unas",
  "y", "o", "u", "e", "en", "con", "por", "para", "que", "le", "lo", "al", "a",
  "su", "sus", "se", "ya", "no", "si", "sin", "mas", "muy", "es", "son", "ser",
  "fue", "han", "hay", "este", "esta", "estos", "estas", "ese", "esa", "esos",
  "esas", "como", "cual", "cuales", "cuando", "donde", "entre", "sobre", "tras",
  "ante", "bajo", "cada", "pero", "porque", "asi", "tal", "tan", "todo", "toda",
  "todos", "todas", "otro", "otra", "otros", "otras", "mismo", "misma",
]);

const GENERIC_TOKENS = new Set([
  "universidad", "facultad", "carrera", "materia", "apunte", "apuntes",
  "resumen", "resumenes", "parcial", "parciales", "final", "finales", "pdf",
  "clase", "clases", "guia", "guias", "teoria", "practica", "practico",
  "trabajo", "tema", "temas", "unidad", "unidades", "capitulo", "capitulos",
  "ejercicio", "ejercicios", "ejemplo", "ejemplos", "figura", "tabla", "pagina",
  "paginas", "introduccion", "concepto", "conceptos", "nota", "notas",
]);

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isStopword(token: string): boolean {
  return STOPWORDS.has(token);
}

function isGeneric(token: string): boolean {
  return GENERIC_TOKENS.has(token);
}

// Un token "de contenido" aporta señal: longitud suficiente y no es stopword ni
// genérico. (Los números puros se descartan: no son conceptos útiles.)
function isContentToken(token: string): boolean {
  if (token.length < MIN_CONTENT_TOKEN_LENGTH) return false;
  if (/^[0-9]+$/.test(token)) return false;
  return !isStopword(token) && !isGeneric(token);
}

type Candidate = { term: string; freq: number; words: number };

/**
 * Extrae hasta {@link MAX_CHUNK_TERMS} términos/frases cortas y útiles a partir
 * del contenido de los chunks. Cada término:
 *   - está normalizado (lowercase, sin acentos, sin caracteres raros);
 *   - tiene a lo sumo {@link MAX_CHUNK_TERM_LENGTH} caracteres;
 *   - no termina en stopword;
 *   - contiene al menos un token "de contenido";
 *   - está deduplicado.
 *
 * Devuelve [] si no hay contenido aprovechable o ante cualquier error.
 */
export function deriveChunkTerms(contents: Array<string | null | undefined>): string[] {
  try {
    const candidates = new Map<string, Candidate>();
    let processedChars = 0;

    const addCandidate = (term: string, words: number) => {
      if (term.length === 0 || term.length > MAX_CHUNK_TERM_LENGTH) return;
      const existing = candidates.get(term);
      if (existing) {
        existing.freq += 1;
      } else {
        candidates.set(term, { term, freq: 1, words });
      }
    };

    for (const raw of contents) {
      if (typeof raw !== "string" || raw.length === 0) continue;
      if (processedChars >= MAX_TOTAL_CHARS) break;

      const slice =
        processedChars + raw.length > MAX_TOTAL_CHARS
          ? raw.slice(0, MAX_TOTAL_CHARS - processedChars)
          : raw;
      processedChars += slice.length;

      const tokens = normalize(slice).split(" ").filter(Boolean);
      if (tokens.length === 0) continue;

      // Unigramas de contenido: cuentan frecuencia; se filtran por umbral abajo.
      for (const token of tokens) {
        if (isContentToken(token)) addCandidate(token, 1);
      }

      // Frases (n-gramas) dentro del chunk, sin cruzar el límite del chunk.
      for (let n = MIN_PHRASE_WORDS; n <= MAX_PHRASE_WORDS; n++) {
        for (let i = 0; i + n <= tokens.length; i++) {
          const window = tokens.slice(i, i + n);
          const last = window[window.length - 1];
          // No terminar en stopword evita ruido tipo "principio de".
          if (isStopword(last)) continue;
          // La frase debe tener al menos un token de contenido (así
          // "le chatelier" sobrevive por "chatelier").
          if (!window.some(isContentToken)) continue;
          // Descartar frases formadas solo por genéricos.
          if (window.every((t) => isGeneric(t) || isStopword(t))) continue;
          const phrase = window.join(" ");
          if (phrase.length > MAX_CHUNK_TERM_LENGTH) continue;
          addCandidate(phrase, n);
        }
      }
    }

    if (candidates.size === 0) return [];

    // Umbral: los unigramas requieren repetirse (freq >= 2) para evitar ruido;
    // las frases multi-palabra se aceptan aunque aparezcan una vez, porque son
    // mucho más específicas (p. ej. "le chatelier").
    const filtered = Array.from(candidates.values()).filter((c) =>
      c.words >= 2 ? true : c.freq >= 2
    );

    // Score: favorece frecuencia y frases más largas/específicas.
    const ranked = filtered.sort((a, b) => {
      const scoreA = a.freq * a.words;
      const scoreB = b.freq * b.words;
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (b.words !== a.words) return b.words - a.words;
      return a.term.localeCompare(b.term);
    });

    return ranked.slice(0, MAX_CHUNK_TERMS).map((c) => c.term);
  } catch {
    return [];
  }
}
