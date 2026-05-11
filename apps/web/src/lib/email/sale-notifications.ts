import type { createAdminClient } from "@/lib/supabase/admin";
import { generateGoogleCalendarUrl } from "@/lib/calendar";
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

// ==========================================
// TUTORING EMAIL NOTIFICATIONS
// ==========================================

export async function sendTutoringBookingNotifications(
  admin: AdminClient,
  bookingId: string,
  paymentId: string
) {
  const { data: booking, error: bookingError } = await admin
    .from("tutor_bookings")
    .select(
      "id, student_id, tutor_id, scheduled_at, duration_minutes, modality, amount, status, meeting_url, location_details, subjects(name)"
    )
    .eq("id", bookingId)
    .eq("payment_id", paymentId)
    .eq("status", "confirmed")
    .maybeSingle();

  if (bookingError) {
    console.error("Error recuperando booking para emails de tutoría:", bookingError);
    return;
  }

  if (!booking || !booking.scheduled_at) return;

  const [tutorEmail, studentEmail] = await Promise.all([
    getUserEmail(admin, booking.tutor_id),
    getUserEmail(admin, booking.student_id),
  ]);

  if (!tutorEmail && !studentEmail) return;

  const [tutorName, studentName] = await Promise.all([
    getProfileName(admin, booking.tutor_id, "Profesor"),
    getProfileName(admin, booking.student_id, "Alumno"),
  ]);

  const subject = booking.subjects as unknown as { name: string } | { name: string }[] | null;
  const subjectName = Array.isArray(subject) ? subject[0]?.name : subject?.name ?? "Materia";
  
  // Format date/time using the same robust logic as the frontend but locally
  const scheduledDate = new Date(booking.scheduled_at);
  let dateLabel = scheduledDate.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const timeLabel = scheduledDate.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://apunteshub.com";
  const dashboardUrl = `${appUrl}/profile/profesor`;
  const successUrl = `${appUrl}/checkout/clase/success?booking_id=${booking.id}`;
  const calendarUrl = generateGoogleCalendarUrl({
    title: `Clase de ${subjectName} con ${studentName}`,
    description: [
      `Materia: ${subjectName}`,
      `Alumno: ${studentName}`,
      studentEmail ? `Email del alumno: ${studentEmail}` : "",
      `Modalidad: ${booking.modality ?? "online"}`,
      `Reserva: ${dashboardUrl}`,
    ].filter(Boolean).join("\n"),
    location:
      booking.meeting_url ||
      booking.location_details ||
      "Datos de acceso pendientes",
    startDate: scheduledDate,
    durationMinutes: booking.duration_minutes ?? 60,
  });

  const sendPromises: Promise<unknown>[] = [];

  // 1. Send Email to Tutor
  if (tutorEmail) {
    const { buildTutorBookingEmail } = await import("./templates");
    const tutorEmailContent = buildTutorBookingEmail({
      tutorName,
      studentName,
      studentEmail: studentEmail ?? undefined,
      subjectName,
      dateLabel,
      timeLabel,
      durationMinutes: booking.duration_minutes ?? 60,
      modality: booking.modality ?? "online",
      price: Number(booking.amount),
      dashboardUrl,
      calendarUrl,
    });

    sendPromises.push(
      sendTransactionalEmail({
        to: tutorEmail,
        subject: tutorEmailContent.subject,
        html: tutorEmailContent.html,
        text: tutorEmailContent.text,
        idempotencyKey: `tutor-booking-new-tutor-${booking.id}-${paymentId}`,
      })
    );
  }

  // 2. Send Email to Student
  if (studentEmail) {
    const { buildStudentBookingEmail } = await import("./templates");
    const studentEmailContent = buildStudentBookingEmail({
      studentName,
      tutorName,
      subjectName,
      dateLabel,
      timeLabel,
      durationMinutes: booking.duration_minutes ?? 60,
      modality: booking.modality ?? "online",
      price: Number(booking.amount),
      successUrl,
      meetingUrl: booking.meeting_url,
      locationDetails: booking.location_details,
    });

    sendPromises.push(
      sendTransactionalEmail({
        to: studentEmail,
        subject: studentEmailContent.subject,
        html: studentEmailContent.html,
        text: studentEmailContent.text,
        idempotencyKey: `tutor-booking-new-student-${booking.id}-${paymentId}`,
      })
    );
  }

  await Promise.allSettled(sendPromises);
}
