import type { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "./resend";
import { buildSellerSaleEmail } from "./templates";

type AdminClient = ReturnType<typeof createAdminClient>;

function normalizeName(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

async function getUserEmail(admin: AdminClient, userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw error;
  return data.user?.email ?? null;
}

async function getProfileName(admin: AdminClient, userId: string, fallback: string) {
  const { data } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  return normalizeName(data?.display_name, fallback);
}

export async function sendResumeSaleNotification(
  admin: AdminClient,
  purchaseId: string,
  paymentId: string
) {
  const { data: purchase } = await admin
    .from("purchases")
    .select(
      "id, seller_id, buyer_id, amount, platform_fee, seller_amount, resumes(title, subject, university)"
    )
    .eq("id", purchaseId)
    .eq("payment_id", paymentId)
    .eq("status", "completed")
    .maybeSingle();

  if (!purchase) return;

  const resume = (purchase as Record<string, unknown>).resumes as
    | { title: string; subject: string; university: string }
    | null;
  const sellerEmail = await getUserEmail(admin, purchase.seller_id);
  if (!sellerEmail) return;

  const [sellerName, buyerName] = await Promise.all([
    getProfileName(admin, purchase.seller_id, "vendedor"),
    getProfileName(admin, purchase.buyer_id, "Comprador"),
  ]);

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://apunteshub.com"}/sell/dashboard`;
  const email = buildSellerSaleEmail({
    kind: "resume",
    sellerName,
    buyerName,
    productTitle: resume?.title ?? "Apunte",
    productContext: [resume?.subject, resume?.university].filter(Boolean).join(" · "),
    amount: Number(purchase.amount),
    platformFee: Number(purchase.platform_fee),
    sellerAmount: Number(purchase.seller_amount),
    paymentId,
    dashboardUrl,
  });

  await sendTransactionalEmail({
    to: sellerEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey: `seller-sale-resume-${purchaseId}-${paymentId}`,
  });
}

export async function sendCourseSaleNotification(
  admin: AdminClient,
  enrollmentId: string,
  paymentId: string
) {
  const { data: enrollment } = await admin
    .from("course_enrollments")
    .select(
      "id, student_id, amount, platform_fee, seller_amount, recorded_courses!inner(title, author_id, subjects(name, university))"
    )
    .eq("id", enrollmentId)
    .eq("payment_id", paymentId)
    .eq("status", "completed")
    .maybeSingle();

  if (!enrollment) return;

  const course = (enrollment as Record<string, unknown>).recorded_courses as
    | {
        title: string;
        author_id: string;
        subjects: { name: string; university: string } | null;
      }
    | null;
  if (!course) return;

  const sellerEmail = await getUserEmail(admin, course.author_id);
  if (!sellerEmail) return;

  const [sellerName, buyerName] = await Promise.all([
    getProfileName(admin, course.author_id, "vendedor"),
    getProfileName(admin, enrollment.student_id, "Alumno"),
  ]);

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://apunteshub.com"}/sell/dashboard`;
  const email = buildSellerSaleEmail({
    kind: "course",
    sellerName,
    buyerName,
    productTitle: course.title,
    productContext: [course.subjects?.name, course.subjects?.university]
      .filter(Boolean)
      .join(" · "),
    amount: Number(enrollment.amount),
    platformFee: Number(enrollment.platform_fee),
    sellerAmount: Number(enrollment.seller_amount),
    paymentId,
    dashboardUrl,
  });

  await sendTransactionalEmail({
    to: sellerEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey: `seller-sale-course-${enrollmentId}-${paymentId}`,
  });
}
