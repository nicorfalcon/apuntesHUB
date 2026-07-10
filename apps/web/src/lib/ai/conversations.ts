import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudyChatAnswerMode } from "@/lib/ai/chat-request";

export type AiMessageRole = "user" | "assistant";

export interface AiConversationSummary {
  id: string;
  resumeId: string | null;
  title: string;
  lastMessagePreview: string | null;
  messageCount: number;
  lastModelProvider: string | null;
  lastModelId: string | null;
  lastAnswerMode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiConversationMessageDto {
  id: string;
  conversationId: string;
  role: AiMessageRole;
  content: string;
  sources: unknown[];
  rawSources: unknown[];
  activity: unknown | null;
  answerMode: string | null;
  modelProvider: string | null;
  modelId: string | null;
  latencyMs: number | null;
  createdAt: string;
}

type SupabaseLike = SupabaseClient;

type ConversationRow = {
  id: string;
  resume_id: string | null;
  title: string;
  last_message_preview: string | null;
  message_count: number | null;
  last_model_provider: string | null;
  last_model_id: string | null;
  last_answer_mode: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: AiMessageRole;
  content: string;
  sources: unknown;
  raw_sources: unknown;
  activity: unknown | null;
  answer_mode: string | null;
  model_provider: string | null;
  model_id: string | null;
  latency_ms: number | null;
  created_at: string;
};

export const AI_CONVERSATION_TITLE_MAX = 80;
export const AI_CONVERSATION_PREVIEW_MAX = 180;
export const AI_MESSAGE_CONTENT_MAX = 12_000;
const FALLBACK_TITLE = "Nueva conversación";

function cleanText(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanMessageContent(value: string): string {
  return value.trim().slice(0, AI_MESSAGE_CONTENT_MAX);
}

export function buildConversationTitle(query: string): string {
  const cleaned = cleanText(query, AI_CONVERSATION_TITLE_MAX);
  return cleaned || FALLBACK_TITLE;
}

export function toConversationSummary(row: ConversationRow): AiConversationSummary {
  return {
    id: row.id,
    resumeId: row.resume_id,
    title: row.title,
    lastMessagePreview: row.last_message_preview,
    messageCount: row.message_count ?? 0,
    lastModelProvider: row.last_model_provider,
    lastModelId: row.last_model_id,
    lastAnswerMode: row.last_answer_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function jsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function toConversationMessage(row: MessageRow): AiConversationMessageDto {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    sources: jsonArray(row.sources),
    rawSources: jsonArray(row.raw_sources),
    activity: row.activity,
    answerMode: row.answer_mode,
    modelProvider: row.model_provider,
    modelId: row.model_id,
    latencyMs: row.latency_ms,
    createdAt: row.created_at,
  };
}

export async function userHasCompletedPurchase(
  supabase: SupabaseLike,
  userId: string,
  resumeId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("purchases")
    .select("id")
    .eq("buyer_id", userId)
    .eq("resume_id", resumeId)
    .eq("status", "completed")
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
}

export async function listResumeConversations(
  supabase: SupabaseLike,
  resumeId: string
): Promise<{ conversations: AiConversationSummary[]; error: string | null }> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select(
      "id, resume_id, title, last_message_preview, message_count, last_model_provider, last_model_id, last_answer_mode, created_at, updated_at"
    )
    .eq("resume_id", resumeId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return { conversations: [], error: error.message };
  return {
    conversations: ((data ?? []) as ConversationRow[]).map(toConversationSummary),
    error: null,
  };
}

export async function getConversationWithMessages(
  supabase: SupabaseLike,
  conversationId: string
): Promise<{
  conversation: AiConversationSummary | null;
  messages: AiConversationMessageDto[];
  error: string | null;
}> {
  const { data: conversation, error: conversationError } = await supabase
    .from("ai_conversations")
    .select(
      "id, resume_id, title, last_message_preview, message_count, last_model_provider, last_model_id, last_answer_mode, created_at, updated_at"
    )
    .eq("id", conversationId)
    .is("archived_at", null)
    .maybeSingle();

  if (conversationError) {
    return { conversation: null, messages: [], error: conversationError.message };
  }
  if (!conversation) {
    return { conversation: null, messages: [], error: null };
  }

  const { data: messages, error: messagesError } = await supabase
    .from("ai_conversation_messages")
    .select(
      "id, conversation_id, role, content, sources, raw_sources, activity, answer_mode, model_provider, model_id, latency_ms, created_at"
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (messagesError) {
    return {
      conversation: toConversationSummary(conversation as ConversationRow),
      messages: [],
      error: messagesError.message,
    };
  }

  return {
    conversation: toConversationSummary(conversation as ConversationRow),
    messages: ((messages ?? []) as MessageRow[]).map(toConversationMessage),
    error: null,
  };
}

export async function createConversation(
  supabase: SupabaseLike,
  input: { userId: string; resumeId: string | null; title: string }
): Promise<{ conversationId: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      user_id: input.userId,
      resume_id: input.resumeId,
      title: cleanText(input.title, AI_CONVERSATION_TITLE_MAX) || FALLBACK_TITLE,
    })
    .select("id")
    .single();

  if (error) return { conversationId: null, error: error.message };
  return { conversationId: data.id as string, error: null };
}

export async function appendConversationMessage(
  supabase: SupabaseLike,
  input: {
    conversationId: string;
    role: AiMessageRole;
    content: string;
    sources?: unknown[];
    rawSources?: unknown[];
    activity?: unknown | null;
    answerMode?: StudyChatAnswerMode | string | null;
    modelProvider?: string | null;
    modelId?: string | null;
    latencyMs?: number | null;
  }
): Promise<{ messageId: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("ai_conversation_messages")
    .insert({
      conversation_id: input.conversationId,
      role: input.role,
      content: cleanMessageContent(input.content),
      sources: input.sources ?? [],
      raw_sources: input.rawSources ?? [],
      activity: input.activity ?? null,
      answer_mode: input.answerMode ?? null,
      model_provider: input.modelProvider ?? null,
      model_id: input.modelId ?? null,
      latency_ms: input.latencyMs ?? null,
    })
    .select("id")
    .single();

  if (error) return { messageId: null, error: error.message };
  return { messageId: data.id as string, error: null };
}

export async function conversationBelongsToUser(
  supabase: SupabaseLike,
  conversationId: string,
  userId: string
): Promise<{ ok: boolean; resumeId: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("resume_id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) return { ok: false, resumeId: null, error: error.message };
  if (!data) return { ok: false, resumeId: null, error: null };
  return { ok: true, resumeId: data.resume_id as string | null, error: null };
}
