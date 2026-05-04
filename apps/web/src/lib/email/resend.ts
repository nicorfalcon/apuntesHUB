interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "ApuntesHub <no-reply@apunteshub.com>";

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
}: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? DEFAULT_FROM;

  if (!apiKey) {
    console.warn("RESEND_API_KEY no configurado; email omitido.");
    return { skipped: true };
  }

  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend error ${response.status}: ${detail}`);
  }

  return response.json();
}
