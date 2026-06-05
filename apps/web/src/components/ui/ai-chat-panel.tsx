"use client";

import { useState, useRef, useEffect } from "react";
import { GraduationCap, MessageSquare, Send } from "lucide-react";
import { useAIModels } from "@/hooks/use-ai-models";
import { ModelSelector } from "./model-selector";
import { AnswerModeSelector } from "./answer-mode-selector";
import type { StudyChatAnswerMode } from "./answer-mode-selector";
import { SourcePills } from "./source-pills";
import type { Source } from "./source-pills";
import { StudyPanel } from "./study-panel";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

type PanelTab = "chat" | "study";

interface AiChatPanelProps {
  resumeId: string;
  resumeTitle: string;
  resumeSubject?: string;
  resumeTopics?: string[] | null;
  aiReady: boolean;
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function AssistantAnswer({ content }: { content: string }) {
  const sectionPattern = /^(Según el apunte|Esto significa|Ejemplo ilustrativo|Para practicar)\s*:?\s*$/i;
  const lines = content.split(/\n/);
  const sections: Array<{ title: string; body: string[] }> = [];
  let current: { title: string; body: string[] } | null = null;
  const intro: string[] = [];

  for (const line of lines) {
    const match = line.trim().match(sectionPattern);
    if (match) {
      current = { title: match[1], body: [] };
      sections.push(current);
      continue;
    }
    if (current) current.body.push(line);
    else intro.push(line);
  }

  if (sections.length === 0) {
    return <p className="whitespace-pre-wrap leading-7">{content}</p>;
  }

  return (
    <div className="space-y-3 leading-7">
      {intro.join("\n").trim() && (
        <p className="whitespace-pre-wrap">{intro.join("\n").trim()}</p>
      )}
      {sections.map((section) => (
        <section
          key={section.title}
          className="border-t border-gray-200/80 pt-3 first:border-t-0 first:pt-0 dark:border-white/10"
        >
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-sand-300/70">
            {section.title}
          </h4>
          <p className="whitespace-pre-wrap">{section.body.join("\n").trim()}</p>
        </section>
      ))}
    </div>
  );
}

export function AiChatPanel({
  resumeId,
  resumeTitle,
  resumeSubject,
  resumeTopics,
  aiReady,
}: AiChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>("chat");
  const [studyTopic, setStudyTopic] = useState("");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerMode, setAnswerMode] = useState<StudyChatAnswerMode>("auto");
  const bottomRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<PanelTab, HTMLButtonElement | null>>({
    chat: null,
    study: null,
  });

  function openStudyWithTopic(topic: string) {
    setStudyTopic(topic.trim());
    setTab("study");
  }

  // Navegación por teclado del tablist (roving focus): flechas alternan entre
  // Chat y Estudiar, Home va a Chat y End a Estudiar.
  function handleTabKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    let next: PanelTab | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      next = tab === "chat" ? "study" : "chat";
    } else if (e.key === "Home") {
      next = "chat";
    } else if (e.key === "End") {
      next = "study";
    }
    if (!next) return;
    e.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  const { models, selectedModel, setSelectedModel, loading: modelsLoading, goToAddKey } = useAIModels();

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  async function onSend() {
    const q = query.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuery("");
    setLoading(true);
    setError(null);

    try {
      const recentMessages = messages
        .map((message) => ({ role: message.role, content: message.content }))
        .slice(-6);
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          resumeIds: [resumeId],
          apiKeyId: selectedModel.id,
          messages: recentMessages,
          resumeTitle,
          subject: resumeSubject,
          topics: resumeTopics ?? [],
          answerMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Si la key fue eliminada mientras el panel estaba abierto, caer al modelo platform
        if (res.status === 404 && selectedModel.id !== "platform") {
          setSelectedModel(models.find((m) => m.id === "platform") ?? selectedModel);
          setError("La API key ya no existe. Se cambió al modelo por defecto de apuntesHUB.");
        } else {
          setError(data.error ?? "Error desconocido");
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.answer,
            sources: data.sources,
          },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente IA"
          className="fixed bottom-4 right-4 z-40 flex min-h-11 items-center gap-2 rounded-full bg-accent-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200 sm:bottom-6 sm:right-6 sm:px-4"
        >
          <SparkleIcon />
          <span className="hidden sm:inline">Asistente IA</span>
        </button>
      )}

      {/* Panel lateral */}
      {open && (
        <div className="fixed inset-x-0 top-14 z-50 flex h-[calc(100svh-56px)] flex-col border-l border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0f1e1a] dark:shadow-black/35 sm:left-auto sm:right-0 sm:w-[min(24rem,calc(100vw-2rem))]">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-white/10">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Asistente IA</p>
              <p className="truncate text-xs text-gray-400 dark:text-sand-300/65">{resumeTitle}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar panel"
              className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-sand-300/65 dark:hover:bg-white/10 dark:hover:text-sand-50"
            >
              <XIcon />
            </button>
          </div>

          {!aiReady ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-sand-300/65">
                <SparkleIcon />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-sand-50">Apunte no procesado</p>
              <p className="text-xs leading-relaxed text-gray-400 dark:text-sand-300/65">
                El vendedor todavía no activó el asistente IA para este apunte.
              </p>
            </div>
          ) : (
            <>
              {/* Selector de modelo */}
              {!modelsLoading && (
                <ModelSelector
                  models={models}
                  selected={selectedModel}
                  onChange={setSelectedModel}
                  onAddKey={goToAddKey}
                />
              )}

              {/* Tabs Chat / Estudiar */}
              <div
                role="tablist"
                aria-label="Modo del asistente"
                onKeyDown={handleTabKeyDown}
                className="flex shrink-0 gap-1 border-b border-gray-100 px-3 pt-2 dark:border-white/10"
              >
                {([
                  { id: "chat" as const, label: "Chat", icon: MessageSquare },
                  { id: "study" as const, label: "Estudiar", icon: GraduationCap },
                ]).map((t) => {
                  const active = tab === t.id;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      ref={(el) => {
                        tabRefs.current[t.id] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`ai-chat-tab-${t.id}`}
                      aria-selected={active}
                      aria-controls={`ai-chat-panel-${t.id}`}
                      tabIndex={active ? 0 : -1}
                      onClick={() => setTab(t.id)}
                      className={`inline-flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 ${
                        active
                          ? "border-accent-500 text-accent-700 dark:border-accent-300 dark:text-accent-200"
                          : "border-transparent text-gray-400 hover:text-gray-700 dark:text-sand-300/60 dark:hover:text-sand-100"
                      }`}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div
                role="tabpanel"
                id={`ai-chat-panel-${tab}`}
                aria-labelledby={`ai-chat-tab-${tab}`}
                tabIndex={0}
                className="flex min-h-0 flex-1 flex-col focus-visible:outline-none"
              >
              {tab === "study" ? (
                <StudyPanel
                  key={studyTopic}
                  resumeId={resumeId}
                  resumeTitle={resumeTitle}
                  resumeSubject={resumeSubject}
                  resumeTopics={resumeTopics}
                  apiKeyId={selectedModel.id}
                  initialTopic={studyTopic}
                  onBackToChat={() => setTab("chat")}
                />
              ) : (
                <>
                  {/* Mensajes */}
                  <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
                    {messages.length === 0 && (
                      <p className="mt-8 text-center text-xs text-gray-400 dark:text-sand-300/65">
                        {selectedModel.hasWebSearch
                          ? "Preguntá sobre el apunte o cualquier tema relacionado. Voy a combinar el apunte con búsqueda en internet."
                          : "Hacé una pregunta sobre este apunte"}
                      </p>
                    )}
                    {messages.map((m, i) => (
                      <div key={i} className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start"}>
                        <div
                          className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm sm:max-w-[92%] ${
                            m.role === "user"
                              ? "bg-accent-600 text-white dark:bg-accent-300 dark:text-[#071713]"
                              : "border border-gray-200 bg-gray-50/90 text-gray-800 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-sand-50"
                          }`}
                        >
                          {m.role === "assistant" ? (
                            <AssistantAnswer content={m.content} />
                          ) : (
                            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                          )}
                        </div>
                        {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                          <SourcePills sources={m.sources} />
                        )}
                      </div>
                    ))}
                    {loading && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-sand-300/65">
                          Pensando…
                        </div>
                      </div>
                    )}
                    {error && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
                        {error}
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input */}
                  <div className="shrink-0 border-t border-gray-100 p-3 dark:border-white/10">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <AnswerModeSelector
                        value={answerMode}
                        onChange={setAnswerMode}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => openStudyWithTopic(query)}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-accent-700 transition hover:bg-accent-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 dark:text-accent-200 dark:hover:bg-accent-300/10"
                      >
                        <GraduationCap aria-hidden="true" className="h-3.5 w-3.5" />
                        Practicar este tema
                      </button>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
                        placeholder={
                          selectedModel.hasWebSearch
                            ? "Preguntá sobre el apunte o cualquier tema…"
                            : "Preguntá sobre este apunte…"
                        }
                        disabled={loading}
                        className="min-h-10 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500/30 disabled:opacity-40 dark:border-white/15 dark:bg-white/5 dark:placeholder:text-sand-300/45 dark:focus:ring-accent-300/20"
                      />
                      <button
                        onClick={onSend}
                        disabled={loading || !query.trim()}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-40 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
                      >
                        <Send aria-hidden="true" className="h-4 w-4" />
                        Enviar
                      </button>
                    </div>
                  </div>
                </>
              )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
