"use client";

import { useState } from "react";
import type { StudyActivity } from "@/lib/ai/study-activity";
import type { Source } from "./source-pills";
import { SourcePills } from "./source-pills";
import {
  StudySetup,
  type PracticeType,
  type PracticeCount,
} from "./study-setup";
import { StudySession, type StudyResultSummary } from "./study-session";
import { StudyResults } from "./study-results";

interface Props {
  resumeId: string;
  resumeTitle: string;
  resumeSubject?: string;
  resumeTopics?: string[] | null;
  apiKeyId: string;
  conversationId?: string | null;
  initialTopic?: string;
  onBackToChat: () => void;
  onConversationCreated?: (conversationId: string) => void;
  onConversationUpdated?: () => void;
}

type Phase = "setup" | "loading" | "session" | "quiz" | "results";

const TYPE_QUERY: Record<PracticeType, string> = {
  multiple_choice: "armame preguntas de opción múltiple para practicar",
  true_false: "armame preguntas de verdadero o falso para practicar",
  quiz: "armame un quiz de preguntas abiertas para practicar",
};

function buildQuery(type: PracticeType, topic: string): string {
  const t = topic.trim();
  const base = TYPE_QUERY[type];
  return t ? `${base} sobre ${t}` : `${base} sobre los conceptos principales del apunte`;
}

function subsetActivity(activity: StudyActivity, ids: string[]): StudyActivity {
  if (activity.type === "true_false") {
    return { ...activity, questions: activity.questions.filter((q) => ids.includes(q.id)) };
  }
  return { ...activity, questions: activity.questions.filter((q) => ids.includes(q.id)) };
}

export function StudyPanel({
  resumeId,
  resumeTitle,
  resumeSubject,
  resumeTopics,
  apiKeyId,
  conversationId,
  initialTopic,
  onBackToChat,
  onConversationCreated,
  onConversationUpdated,
}: Props) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [type, setType] = useState<PracticeType>("multiple_choice");
  const [count, setCount] = useState<PracticeCount>(3);
  const [topic, setTopic] = useState(initialTopic ?? "");
  const [activity, setActivity] = useState<StudyActivity | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [quizText, setQuizText] = useState("");
  const [summary, setSummary] = useState<StudyResultSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  async function generate() {
    setError(null);
    setPhase("loading");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: buildQuery(type, topic),
          resumeIds: [resumeId],
          apiKeyId,
          conversationId,
          persist: true,
          resumeTitle,
          subject: resumeSubject,
          topics: resumeTopics ?? [],
          answerMode: type,
          count,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudo generar la práctica.");
        setPhase("setup");
        return;
      }

      if (typeof data.conversationId === "string" && data.conversationId !== conversationId) {
        onConversationCreated?.(data.conversationId);
      }
      onConversationUpdated?.();

      if (type === "quiz") {
        setQuizText(typeof data.answer === "string" ? data.answer : "");
        setSources(Array.isArray(data.sources) ? data.sources : []);
        setPhase("quiz");
        return;
      }

      if (data.activity) {
        setActivity(data.activity as StudyActivity);
        setSources(Array.isArray(data.sources) ? data.sources : []);
        setSummary(null);
        setSessionKey((k) => k + 1);
        setPhase("session");
      } else {
        setError(
          "No pude armar una práctica interactiva con este tema. Probá con un tema más específico del apunte."
        );
        setPhase("setup");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("setup");
    }
  }

  function handleFinish(result: StudyResultSummary) {
    setSummary(result);
    setPhase("results");
  }

  function retryIncorrect() {
    if (!activity || !summary) return;
    setActivity(subsetActivity(activity, summary.incorrectQuestionIds));
    setSummary(null);
    setSessionKey((k) => k + 1);
    setPhase("session");
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500/30 border-t-accent-600 dark:border-accent-300/20 dark:border-t-accent-300" />
        <p className="text-sm text-gray-500 dark:text-sand-300/70">Generando práctica…</p>
      </div>
    );
  }

  if (phase === "session" && activity) {
    return (
      <StudySession
        key={sessionKey}
        activity={activity}
        sources={sources}
        onFinish={handleFinish}
      />
    );
  }

  if (phase === "quiz") {
    return (
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-accent-700 dark:text-accent-200">
            Preguntas para practicar
          </p>
          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{quizText}</p>
          {sources.length > 0 && <SourcePills sources={sources} />}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setPhase("setup")}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-sand-100 dark:hover:border-white/20"
          >
            Generar otra práctica
          </button>
          <button
            type="button"
            onClick={onBackToChat}
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 dark:text-sand-300/70 dark:hover:text-sand-50"
          >
            Volver al chat
          </button>
        </div>
      </div>
    );
  }

  if (phase === "results" && summary) {
    return (
      <StudyResults
        correct={summary.correct}
        total={summary.total}
        canRetryIncorrect={summary.incorrectQuestionIds.length > 0}
        onRetryIncorrect={retryIncorrect}
        onGenerateAnother={() => setPhase("setup")}
        onBackToChat={onBackToChat}
      />
    );
  }

  return (
    <StudySetup
      type={type}
      onTypeChange={setType}
      count={count}
      onCountChange={setCount}
      topic={topic}
      onTopicChange={setTopic}
      onGenerate={generate}
      error={error}
    />
  );
}
