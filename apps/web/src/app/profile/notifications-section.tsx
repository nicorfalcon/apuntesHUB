"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BadgeDollarSign, CalendarCheck, MessageSquare, MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Las 4 familias de mail que la plataforma manda hoy. */
export interface NotificationPrefs {
  email_sales: boolean;
  email_material_questions: boolean;
  email_question_answers: boolean;
  email_tutoring: boolean;
}

type PrefKey = keyof NotificationPrefs;

const DEFAULT_PREFS: NotificationPrefs = {
  email_sales: true,
  email_material_questions: true,
  email_question_answers: true,
  email_tutoring: true,
};

const OPTIONS: {
  key: PrefKey;
  label: string;
  description: string;
  icon: typeof BadgeDollarSign;
}[] = [
  {
    key: "email_sales",
    label: "Ventas",
    description:
      "Te avisamos por mail cada vez que alguien te compra un apunte, un paquete o un curso, con el detalle del cobro.",
    icon: BadgeDollarSign,
  },
  {
    key: "email_material_questions",
    label: "Consultas sobre tu material",
    description:
      "Cuando un comprador deja una consulta en alguno de tus apuntes o cursos.",
    icon: MessageSquare,
  },
  {
    key: "email_question_answers",
    label: "Respuestas a tus consultas",
    description:
      "Cuando responden una consulta que hiciste (o una que seguís) sobre un material que compraste.",
    icon: MessagesSquare,
  },
  {
    key: "email_tutoring",
    label: "Clases particulares",
    description:
      "Reservas confirmadas y cambios en los detalles de una clase, tanto si das clases como si las tomás.",
    icon: CalendarCheck,
  },
];

interface NotificationsSectionProps {
  userId: string;
  initialPrefs: NotificationPrefs | null;
}

export function NotificationsSection({
  userId,
  initialPrefs,
}: NotificationsSectionProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs ?? DEFAULT_PREFS);
  const [saving, setSaving] = useState<PrefKey | null>(null);

  async function toggle(key: PrefKey) {
    const next = { ...prefs, [key]: !prefs[key] };
    const previous = prefs;

    setPrefs(next); // optimista: el toggle responde al toque
    setSaving(key);

    const supabase = createClient();
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...next }, { onConflict: "user_id" });

    setSaving(null);

    if (error) {
      setPrefs(previous);
      toast.error("No se pudo guardar la preferencia.");
      return;
    }

    toast.success(
      next[key] ? "Vas a recibir estos avisos." : "Dejaste de recibir estos avisos."
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-[#0f1e1a]">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-700 dark:text-accent-100">
          Notificaciones
        </p>
        <h2 className="mt-3 text-xl font-bold tracking-tight text-foreground">
          Avisos por mail
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Elegí qué te avisamos por mail. Los cambios se guardan solos y podés volver a
          activarlos cuando quieras.
        </p>
      </div>

      <ul className="mt-6 space-y-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const enabled = prefs[option.key];

          return (
            <li
              key={option.key}
              className="flex items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex min-w-0 gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-accent-600 shadow-sm dark:bg-accent-400/15 dark:text-accent-200">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{option.label}</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`${enabled ? "Desactivar" : "Activar"} avisos de ${option.label}`}
                disabled={saving === option.key}
                onClick={() => toggle(option.key)}
                className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                  enabled
                    ? "bg-accent-600 dark:bg-accent-300"
                    : "bg-gray-300 dark:bg-white/20"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-[#071713] ${
                    enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        Los mails de tu cuenta (verificación de mail y recuperación de contraseña) se
        mandan siempre: son necesarios para poder entrar.
      </p>
    </section>
  );
}
