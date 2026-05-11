const EXTRACTION_PATTERNS = [
  /transcrib/i,
  /cop[ií][aá]/i,
  /\bvolc[aá](?=[\s,.]|$)/i,
  /dame todo/i,
  /todo el contenido/i,
  /todo lo que (dice|tenés|hay)/i,
  /listá todo/i,
  /pasame todo/i,
  /escribí todo/i,
  /ignor[aá] (las |tus )?(instrucciones|reglas)/i,
  /olvid[aá] (las |tus )?(instrucciones|reglas)/i,
  /nueva (instrucción|regla)/i,
  /\bsystem:\s/i,
  /\bassistant:\s/i,
  /act (as|como)\b/i,
  /pretend (you are|that)/i,
];

export function isExtractionAttempt(query: string): boolean {
  return EXTRACTION_PATTERNS.some((re) => re.test(query));
}
