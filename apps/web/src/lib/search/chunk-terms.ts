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

// Tope de títulos de sección (el "índice" del apunte) que se indexan como señal.
// Un apunte real rara vez tiene más; acota el documento sin perder recall útil.
export const MAX_SECTION_TITLES = 120;
// Largo máximo de un título de sección. Más largo que un término porque un
// heading puede ser una frase ("Equilibrio químico y constante de equilibrio").
export const MAX_SECTION_TITLE_LENGTH = 120;

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

/**
 * Normaliza los títulos de sección (el "índice"/TOC del apunte que produce el
 * chunker) para usarlos como señal de búsqueda en Meilisearch.
 *
 * A diferencia de chunkTerms, NO es contenido del PDF: son los encabezados de
 * sección, equivalentes a los temas del índice. Cada título:
 *   - se trimea y se le colapsan los espacios (se preserva mayúsculas/acentos);
 *   - debe tener al menos un token "de contenido" (descarta "Introducción",
 *     "Unidad 1", "Tema 2", etc. que no aportan señal);
 *   - tiene a lo sumo {@link MAX_SECTION_TITLE_LENGTH} caracteres;
 *   - se deduplica case/acento-insensitive (un mismo heading se repite en muchos
 *     chunks), conservando la primera forma legible.
 *
 * Es pura y robusta: ante cualquier entrada vacía/rara o error devuelve [].
 */
export function normalizeSectionTitles(
  titles: Array<string | null | undefined>
): string[] {
  try {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const raw of titles) {
      if (typeof raw !== "string") continue;
      const display = raw.replace(/\s+/g, " ").trim();
      if (display.length === 0 || display.length > MAX_SECTION_TITLE_LENGTH) {
        continue;
      }
      const normalized = normalize(display);
      if (normalized.length === 0) continue;
      // Descarta headings sin ningún token de contenido (genéricos/numéricos).
      const hasContent = normalized.split(" ").some(isContentToken);
      if (!hasContent) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(display);
      if (result.length >= MAX_SECTION_TITLES) break;
    }

    return result;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Aliases académicos (keywords curadas por reglas)
// ---------------------------------------------------------------------------
//
// Algunos temas tienen un "nombre" (Le Chatelier) que el PDF puede no contener
// literalmente, o que la extracción de texto rompe. Para que igual se puedan
// encontrar, derivamos un puñado de aliases académicos a partir de SEÑALES del
// contenido (no del contenido en sí): título/materia/descripción + chunkTerms.
//
// Reglas conservadoras (para no contaminar el índice con falsos positivos):
//   - Cada regla exige una categoría "ancla" obligatoria (el tema central).
//   - Y al menos {@link MIN_ALIAS_SIGNALS} categorías de señal distintas.
//   - Y al menos 1 señal ESPECÍFICA del dominio (no solo señales compartidas):
//     esto evita disparar en Física/termodinámica/gases, que comparten
//     "equilibrio", "temperatura", "presión", "concentración" con la química
//     pero no son sobre Le Chatelier.
//   - Nunca se dispara por una sola palabra aislada.
//   - Los aliases salen normalizados (lowercase, sin acentos) y acotados en
//     largo (mismo límite que chunkTerms) y cantidad.
//   - Resultado deduplicado.

// Mínimo de categorías de señal distintas para emitir los aliases de una regla.
const MIN_ALIAS_SIGNALS = 3;

// Tope de aliases emitidos en total. Pequeño a propósito: son keywords curadas,
// no contenido. Acota el documento aunque se agreguen más reglas.
export const MAX_ACADEMIC_ALIASES = 16;

type AliasRule = {
  name: string;
  // Categoría ancla: debe matchear sí o sí (el tema central de la regla).
  // Se evalúa contra el haystack normalizado (título+materia+desc+chunkTerms).
  anchor: RegExp;
  // Señales ESPECÍFICAS del dominio: discriminan el tema de áreas vecinas.
  // Debe matchear AL MENOS UNA para disparar. Cuentan hacia el umbral.
  specificSignals: RegExp[];
  // Señales COMPARTIDAS con otras áreas (Física/termo/gases): suman al umbral
  // pero NO alcanzan solas (sin al menos una específica, la regla no dispara).
  sharedSignals: RegExp[];
  // Aliases a emitir si la regla dispara. Se normalizan y deduplican luego.
  aliases: string[];
};

// Las regex corren contra texto YA normalizado (minúsculas, sin acentos, con
// espacios como separadores), por eso usan formas sin tilde y `\b` = espacio.
const ACADEMIC_ALIAS_RULES: AliasRule[] = [
  {
    name: "le-chatelier",
    // Le Chatelier es, por definición, sobre el equilibrio (o su nombre literal).
    anchor: /equilibri|chatelier/,
    // Señales que SÍ indican química/Le Chatelier (no termodinámica genérica).
    specificSignals: [
      /chatelier/, // el nombre literal
      /desplaz/, // se desplaza, desplazamiento (del equilibrio)
      /perturba/, // perturbacion, perturbation
      /cte de equilibri|constante de equilibri/, // constante de equilibrio
      /quimic/, // quimica, quimico
    ],
    // Compartidas con Física/gases/termo: necesarias pero no suficientes.
    sharedSignals: [
      /equilibri/, // equilibrio, equilibrium, equilibria
      /temperatur/, // temperatura, temperature
      /presion/,
      /concentracion/,
    ],
    aliases: [
      "le chatelier",
      "principio de le chatelier",
      "chatelier",
      "desplazamiento del equilibrio",
      "perturbacion del equilibrio",
    ],
  },
];

/**
 * Deriva aliases académicos ("keywords" curadas) a partir de señales del
 * contenido, para mejorar el recall de temas con nombre propio aunque el PDF no
 * los contenga literalmente.
 *
 * Es pura y robusta: ante cualquier entrada vacía/rara o error devuelve [].
 * NO indexa contenido: solo emite términos cortos predefinidos cuando hay
 * suficientes señales.
 */
export function deriveAcademicAliases(input: {
  title: string | null;
  subject: string | null;
  description: string | null;
  chunkTerms: string[];
}): string[] {
  try {
    const haystack = normalize(
      [
        input.title ?? "",
        input.subject ?? "",
        input.description ?? "",
        ...(Array.isArray(input.chunkTerms) ? input.chunkTerms : []),
      ].join(" ")
    );
    if (haystack.length === 0) return [];

    const out: string[] = [];
    for (const rule of ACADEMIC_ALIAS_RULES) {
      // 1) Ancla obligatoria (el tema central).
      if (!rule.anchor.test(haystack)) continue;

      // 2) Al menos una señal ESPECÍFICA del dominio: sin esto, señales solo
      //    compartidas (equilibrio+temperatura+presión) NO bastan, evitando
      //    falsos positivos en Física/termodinámica/gases.
      let specific = 0;
      for (const signal of rule.specificSignals) {
        if (signal.test(haystack)) specific += 1;
      }
      if (specific === 0) continue;

      // 3) Al menos MIN_ALIAS_SIGNALS categorías distintas en total
      //    (específicas + compartidas).
      let shared = 0;
      for (const signal of rule.sharedSignals) {
        if (signal.test(haystack)) shared += 1;
      }
      if (specific + shared < MIN_ALIAS_SIGNALS) continue;

      for (const alias of rule.aliases) out.push(alias);
    }

    // Normalizar, acotar largo y deduplicar manteniendo el orden.
    const seen = new Set<string>();
    const result: string[] = [];
    for (const alias of out) {
      const term = normalize(alias);
      if (term.length === 0 || term.length > MAX_CHUNK_TERM_LENGTH) continue;
      if (seen.has(term)) continue;
      seen.add(term);
      result.push(term);
    }

    return result.slice(0, MAX_ACADEMIC_ALIASES);
  } catch {
    return [];
  }
}
