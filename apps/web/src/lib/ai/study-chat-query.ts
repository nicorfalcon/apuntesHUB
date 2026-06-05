export type StudyChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_RECENT_MESSAGES = 6;
const MAX_QUERY_LENGTH = 320;
const MAX_TOPIC_LENGTH = 140;

const VAGUE_FOLLOW_UP_PATTERNS = [
  /\beso\b/i,
  /\bsobre eso\b/i,
  /\blo anterior\b/i,
  /\bese tema\b/i,
  /\bexplic(?:a|á|ame|ame|arme|as|ás)(?:me)?\s+m[aá]s\b/i,
  /\bme pod[eé]s explicar m[aá]s\b/i,
  /\bno entend[ií]\b/i,
  /\bdame un ejemplo\b/i,
  /\bpod[eé]s darme un ejemplo\b/i,
  /\bhac(?:e|é)me preguntas\b/i,
  /\bpreguntas para practicar\b/i,
  /\bmini quiz\b/i,
  /\bpara practicar\b/i,
  /\bverdadero\s+o\s+falso\b/i,
  /\bmultiple choice\b/i,
  /\bopci[oó]n\s+m[uú]ltiple\b/i,
  /\bpreguntas\s+con\s+opciones\b/i,
  /\by eso c[oó]mo ser[ií]a\b/i,
  /^\s*y\s+si\b/i,
  /^\s*y\s+qu[eé]\s+pasa\s+si\b/i,
  /^\s*qu[eé]\s+pasa\s+si\b/i,
];

const GENERIC_TOPIC_WORDS = new Set([
  "eso",
  "tema",
  "anterior",
  "ejemplo",
  "explicacion",
  "explicación",
  "apunte",
  "fragmento",
  "pregunta",
  "respuesta",
]);

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isProbablySameMessage(a: string, b: string): boolean {
  return stripAccents(normalizeSpaces(a).toLowerCase()) ===
    stripAccents(normalizeSpaces(b).toLowerCase());
}

function truncate(value: string, maxLength: number): string {
  const text = normalizeSpaces(value);
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
}

export function isVagueStudyFollowUp(message: string): boolean {
  const text = normalizeSpaces(message);
  if (!text) return false;
  if (VAGUE_FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(text))) return true;

  const normalized = stripAccents(text.toLowerCase());
  return normalized.length <= 34 &&
    /^(me explicas mas|explicame mas|mas detalle|un ejemplo|otro ejemplo|como seria|y como seria|por que pasa eso)$/.test(normalized);
}

function isUsefulTopic(topic: string): boolean {
  const compactOriginal = topic.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]/g, "");
  if (
    compactOriginal.length >= 2 &&
    /[A-ZÀ-ÖØ-Þ0-9]/.test(compactOriginal) &&
    !GENERIC_TOPIC_WORDS.has(stripAccents(topic.toLowerCase()))
  ) {
    return true;
  }

  const normalized = stripAccents(topic.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length < 3) return false;

  const words = normalized.split(" ").filter(Boolean);
  if (words.length === 0) return false;
  return words.some((word) => !GENERIC_TOPIC_WORDS.has(word));
}

function cleanupUserTopic(message: string): string | null {
  let candidate = normalizeSpaces(message)
    .replace(/[¿?¡!]+/g, "")
    .replace(/^(?:me\s+)?(?:pod[eé]s|puedes|podr[ií]as)\s+/i, "")
    .replace(/^(?:qu[eé]\s+es|que\s+es|explic(?:a|á|ame|ame|as|ás)(?:me)?|defin(?:i|í|ime|ime)|contame|hablame)\s+(?:sobre\s+|acerca\s+de\s+|el\s+|la\s+|los\s+|las\s+|un\s+|una\s+)?/i, "")
    .replace(/^(?:dame|d[aá]me)\s+(?:un\s+)?ejemplo\s+(?:de\s+|sobre\s+)?/i, "")
    .trim();

  candidate = candidate.replace(/\s+(?:por favor|pls)$/i, "").trim();
  candidate = truncate(candidate, MAX_TOPIC_LENGTH);
  return isUsefulTopic(candidate) ? candidate : null;
}

function firstAssistantSentence(message: string): string {
  const text = normalizeSpaces(message);
  const match = text.match(/^(.{20,220}?[.!?])(?:\s|$)/);
  return truncate(match?.[1] ?? text, MAX_TOPIC_LENGTH);
}

function cleanupAssistantTopic(message: string): string | null {
  const sentence = firstAssistantSentence(message)
    .replace(/^\s*(?:claro[:,]?\s*)?/i, "")
    .trim();

  const leChatelier = sentence.match(/(?:principio\s+de\s+)?Le\s+Ch[aâ]telier/i);
  if (leChatelier) return leChatelier[0].replace(/Châtelier/i, "Chatelier");

  const named = sentence.match(/(?:se llama|se conoce como|es|describe|explica)\s+([^.;:]{4,120})/i);
  const candidate = truncate(named?.[1] ?? sentence, MAX_TOPIC_LENGTH)
    .replace(/^(?:el|la|los|las|un|una)\s+/i, "")
    .trim();

  return isUsefulTopic(candidate) ? candidate : null;
}

function recentRelevantMessages(
  messages: StudyChatMessage[],
  latestUserMessage: string
): StudyChatMessage[] {
  return messages
    .filter((message) =>
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      normalizeSpaces(message.content).length > 0 &&
      !(message.role === "user" && isProbablySameMessage(message.content, latestUserMessage))
    )
    .slice(-MAX_RECENT_MESSAGES);
}

function findPreviousTopic(
  messages: StudyChatMessage[],
  latestUserMessage: string
): string | null {
  const recent = recentRelevantMessages(messages, latestUserMessage);

  for (let i = recent.length - 1; i >= 0; i--) {
    const message = recent[i];
    if (message.role !== "user" || isVagueStudyFollowUp(message.content)) continue;
    const topic = cleanupUserTopic(message.content);
    if (topic) return topic;
  }

  for (let i = recent.length - 1; i >= 0; i--) {
    const message = recent[i];
    if (message.role !== "assistant") continue;
    const topic = cleanupAssistantTopic(message.content);
    if (topic) return topic;
  }

  return null;
}

function appendContext(parts: string[], value?: string | null) {
  const text = value ? normalizeSpaces(value) : "";
  if (text && !parts.some((part) => isProbablySameMessage(part, text))) {
    parts.push(text);
  }
}

export function rewriteStudyChatQuery(input: {
  latestUserMessage: string;
  recentMessages: StudyChatMessage[];
  resumeTitle?: string | null;
  subject?: string | null;
}): {
  retrievalQuery: string;
  wasRewritten: boolean;
} {
  const latest = normalizeSpaces(input.latestUserMessage);
  if (!latest) return { retrievalQuery: latest, wasRewritten: false };

  if (!isVagueStudyFollowUp(latest)) {
    return { retrievalQuery: latest, wasRewritten: false };
  }

  const previousTopic = findPreviousTopic(input.recentMessages, latest);
  if (!previousTopic) {
    return { retrievalQuery: latest, wasRewritten: false };
  }

  const parts = [latest, `sobre ${previousTopic}`];
  appendContext(parts, input.resumeTitle);
  appendContext(parts, input.subject);

  return {
    retrievalQuery: truncate(parts.join(" "), MAX_QUERY_LENGTH),
    wasRewritten: true,
  };
}
