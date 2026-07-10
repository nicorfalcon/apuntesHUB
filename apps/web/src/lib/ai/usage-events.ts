import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudyChatAnswerMode } from "@/lib/ai/chat-request";

export type AiUsageEventType =
  | "chat_message"
  | "study_activity_generated"
  | "chat_error";

export type AiUsageStatus = "success" | "error";

type SupabaseLike = SupabaseClient;

export async function recordAiUsageEvent(
  supabase: SupabaseLike,
  input: {
    userId: string;
    resumeId?: string | null;
    conversationId?: string | null;
    messageId?: string | null;
    eventType: AiUsageEventType;
    answerMode?: StudyChatAnswerMode | string | null;
    modelProvider?: string | null;
    modelId?: string | null;
    status: AiUsageStatus;
    errorCode?: string | null;
    latencyMs?: number | null;
    retrievalQueryLength?: number | null;
    contextChunkCount?: number | null;
    contextCharCount?: number | null;
    sourceCount?: number | null;
  }
): Promise<void> {
  const { error } = await supabase.from("ai_usage_events").insert({
    user_id: input.userId,
    resume_id: input.resumeId ?? null,
    conversation_id: input.conversationId ?? null,
    message_id: input.messageId ?? null,
    event_type: input.eventType,
    answer_mode: input.answerMode ?? null,
    model_provider: input.modelProvider ?? null,
    model_id: input.modelId ?? null,
    status: input.status,
    error_code: input.errorCode ?? null,
    latency_ms: input.latencyMs ?? null,
    retrieval_query_length: input.retrievalQueryLength ?? null,
    context_chunk_count: input.contextChunkCount ?? null,
    context_char_count: input.contextCharCount ?? null,
    source_count: input.sourceCount ?? null,
  });

  if (error) {
    console.warn("[ai:usage] failed to record event", {
      message: error.message,
      eventType: input.eventType,
      status: input.status,
    });
  }
}

export function getPrimaryResumeId(resumeIds: string[] | null): string | null {
  return resumeIds && resumeIds.length === 1 ? resumeIds[0] : null;
}
