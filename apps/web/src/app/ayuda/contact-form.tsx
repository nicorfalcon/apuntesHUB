"use client";

import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, CheckCircle2, Loader2 } from "lucide-react";

const TOPICS = [
  { value: "buscando", label: "No encuentro lo que busco" },
  { value: "compra", label: "Problema con una compra o pago" },
  { value: "cuenta", label: "Mi cuenta o acceso" },
  { value: "vender", label: "Vender apuntes, cursos o clases" },
  { value: "tecnico", label: "Algo no funciona" },
  { value: "otro", label: "Otra consulta" },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_MAX = 4000;

const fieldBase =
  "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.02)] outline-none transition-colors [touch-action:manipulation] placeholder:text-muted-foreground/70 dark:bg-[#0b1714]";
const fieldOk =
  "border-gray-200 focus-visible:border-accent-400 focus-visible:ring-2 focus-visible:ring-accent-200/70 dark:border-white/10 dark:focus-visible:border-accent-300/50 dark:focus-visible:ring-accent-300/20";
const fieldError =
  "border-red-400 focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-200/70 dark:border-red-500/60 dark:focus-visible:ring-red-500/25";

function fieldClass(hasError: boolean) {
  return `${fieldBase} ${hasError ? fieldError : fieldOk}`;
}

interface FieldErrors {
  email?: string;
  message?: string;
}

export function ContactForm() {
  const uid = useId();
  const emailId = `${uid}-email`;
  const nameId = `${uid}-name`;
  const topicId = `${uid}-topic`;
  const messageId = `${uid}-message`;
  const emailErrorId = `${uid}-email-error`;
  const messageErrorId = `${uid}-message-error`;

  const emailRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const [topic, setTopic] = useState<string>("buscando");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!EMAIL_RE.test(email.trim())) {
      next.email = "Ingresá un email válido para que podamos responderte.";
    }
    if (message.trim().length < 10) {
      next.message = "Contanos un poco más: al menos 10 caracteres.";
    }
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextErrors.message) {
      messageRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          topic,
          message: message.trim(),
          company,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No pudimos enviar tu mensaje. Probá de nuevo.");
        return;
      }
      setSent(true);
    } catch {
      toast.error("No pudimos enviar tu mensaje. Revisá tu conexión.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div
        role="status"
        className="flex flex-col items-start gap-3 rounded-2xl border border-accent-200/70 bg-accent-50/60 px-6 py-8 dark:border-accent-300/25 dark:bg-accent-300/10"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-300/20 dark:text-accent-200">
          <CheckCircle2 className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h3 className="text-balance font-display text-2xl italic text-foreground">
          Recibimos tu mensaje.
        </h3>
        <p className="max-w-md text-pretty text-sm leading-6 text-muted-foreground">
          Te vamos a responder a{" "}
          <span className="font-medium text-foreground" translate="no">
            {email.trim()}
          </span>{" "}
          lo antes posible. Revisá también tu carpeta de spam por las dudas.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setMessage("");
            setErrors({});
          }}
          className="mt-1 rounded text-sm font-semibold text-accent-700 transition-colors hover:text-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-200/70 dark:text-accent-200 dark:hover:text-accent-100"
        >
          Enviar otra consulta
        </button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="rounded-2xl border border-gray-200 bg-white/60 p-6 dark:border-white/10 dark:bg-white/[0.03] md:p-7"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={emailId} className="mb-1.5 block text-xs font-semibold text-foreground">
            Tu email <span className="text-accent-600 dark:text-accent-300">*</span>
          </label>
          <input
            id={emailId}
            ref={emailRef}
            type="email"
            inputMode="email"
            required
            spellCheck={false}
            autoCapitalize="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
            }}
            placeholder="vos@ejemplo.com"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? emailErrorId : undefined}
            className={fieldClass(Boolean(errors.email))}
          />
          {errors.email && (
            <p id={emailErrorId} className="mt-1.5 text-xs leading-5 text-red-600 dark:text-red-400">
              {errors.email}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={nameId} className="mb-1.5 block text-xs font-semibold text-foreground">
            Nombre <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id={nameId}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cómo te llamás…"
            autoComplete="name"
            className={fieldClass(false)}
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor={topicId} className="mb-1.5 block text-xs font-semibold text-foreground">
          ¿Sobre qué es?
        </label>
        <select
          id={topicId}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className={fieldClass(false)}
        >
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label htmlFor={messageId} className="mb-1.5 block text-xs font-semibold text-foreground">
          Contanos qué necesitás <span className="text-accent-600 dark:text-accent-300">*</span>
        </label>
        <textarea
          id={messageId}
          ref={messageRef}
          required
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (errors.message) setErrors((p) => ({ ...p, message: undefined }));
          }}
          rows={5}
          maxLength={MESSAGE_MAX}
          placeholder="Describí el problema o qué estabas buscando. Cuanto más detalle, mejor te ayudamos…"
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? messageErrorId : undefined}
          className={`${fieldClass(Boolean(errors.message))} resize-y leading-6`}
        />
        {errors.message && (
          <p id={messageErrorId} className="mt-1.5 text-xs leading-5 text-red-600 dark:text-red-400">
            {errors.message}
          </p>
        )}
      </div>

      {/* Honeypot anti-spam: oculto para personas, tentador para bots. */}
      <input
        type="text"
        name="company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors [touch-action:manipulation] hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 dark:bg-accent-300 dark:text-[#08130f] dark:hover:bg-accent-200"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Enviando…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
              Enviar consulta
            </>
          )}
        </button>
        <p className="text-xs leading-5 text-muted-foreground">
          Te respondemos por email al correo que dejes.
        </p>
      </div>
    </form>
  );
}
