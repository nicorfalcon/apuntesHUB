import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Familias de mail que el usuario puede activar o desactivar desde
 * Perfil → Notificaciones. Cada una mapea a una columna de notification_preferences.
 */
export type EmailNotificationKind =
  | "sales"
  | "material_questions"
  | "question_answers"
  | "tutoring";

const COLUMN_BY_KIND: Record<EmailNotificationKind, string> = {
  sales: "email_sales",
  material_questions: "email_material_questions",
  question_answers: "email_question_answers",
  tutoring: "email_tutoring",
};

/**
 * ¿El usuario quiere recibir este tipo de mail?
 *
 * El default es SÍ: si no tiene fila de preferencias (nunca tocó un toggle) o la consulta
 * falla, se manda igual. Un aviso de venta de más molesta menos que perderse una venta.
 */
export async function wantsEmail(
  admin: AdminClient,
  userId: string,
  kind: EmailNotificationKind
): Promise<boolean> {
  const { data, error } = await admin
    .from("notification_preferences")
    .select(
      "email_sales, email_material_questions, email_question_answers, email_tutoring"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return true;

  const value = (data as unknown as Record<string, unknown>)[COLUMN_BY_KIND[kind]];
  return value !== false;
}
