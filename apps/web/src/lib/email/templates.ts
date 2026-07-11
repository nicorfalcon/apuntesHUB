interface SaleEmailInput {
  kind: "resume" | "course";
  sellerName: string;
  buyerName: string;
  productTitle: string;
  productContext: string;
  amount: number;
  platformFee: number;
  sellerAmount: number;
  paymentId: string;
  dashboardUrl: string;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatArs(value: number) {
  return `$${Math.round(value).toLocaleString("es-AR")} ARS`;
}

function summaryRow(label: string, value: string, strong = false) {
  return `
    <tr>
      <td style="padding:12px 0;color:#73829a;font-size:14px;border-bottom:1px solid #e6ebf2;">${label}</td>
      <td style="padding:12px 0;color:#111b3a;font-size:14px;text-align:right;border-bottom:1px solid #e6ebf2;${strong ? "font-weight:700;" : ""}">${escapeHtml(value)}</td>
    </tr>
  `;
}

export function buildSellerSaleEmail(input: SaleEmailInput) {
  const isCourse = input.kind === "course";
  const title = isCourse ? "Vendiste un curso grabado" : "Vendiste un apunte";
  const category = "NUEVA VENTA";
  const buyerLabel = isCourse ? "Alumno" : "Comprador";
  const subject = isCourse
    ? `Vendiste el curso "${input.productTitle}"`
    : `Vendiste el apunte "${input.productTitle}"`;

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;background:#eaf1f7;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#111b3a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td align="center">
              <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="width:100%;max-width:520px;border-collapse:collapse;background:#ffffff;border:1px solid #dbe4ef;">
                <tr>
                  <td align="center" style="background:#091735;padding:44px 24px;">
                    <div style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;">
                      apuntes<span style="color:#08d6ad;">HUB</span><span style="color:#08d6ad;">.</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 32px 28px;">
                    <p style="margin:0 0 24px;color:#60708a;font-size:13px;letter-spacing:0.14em;">${category}</p>
                    <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#111b3a;">${title}</h1>
                    <p style="margin:0 0 22px;color:#43536d;font-size:15px;line-height:1.65;">
                      Hola ${escapeHtml(input.sellerName)}, se acreditó una venta en ApuntesHub. Te dejamos el resumen para que puedas seguirla desde tu panel.
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:8px 0 28px;">
                      ${summaryRow(isCourse ? "Curso" : "Apunte", input.productTitle)}
                      ${summaryRow("Detalle", input.productContext)}
                      ${summaryRow(buyerLabel, input.buyerName)}
                      ${summaryRow("Precio pagado", formatArs(input.amount))}
                      ${summaryRow("Comisión plataforma", formatArs(input.platformFee))}
                      ${summaryRow("Tu ingreso", formatArs(input.sellerAmount), true)}
                    </table>

                    <div style="text-align:center;margin:28px 0 26px;">
                      <a href="${input.dashboardUrl}" style="display:inline-block;background:#08d6ad;color:#071713;text-decoration:none;font-size:14px;font-weight:800;padding:15px 34px;border-radius:7px;">
                        Ver panel de ventas
                      </a>
                    </div>

                    <p style="margin:0;color:#8a99b1;font-size:12px;line-height:1.65;">
                      ID de pago: ${escapeHtml(input.paymentId)}. Los importes mostrados no incluyen posibles comisiones externas de Mercado Pago.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 32px;border-top:1px solid #e6ebf2;color:#8a99b1;font-size:12px;line-height:1.55;">
                    Por seguridad, nunca te pediremos claves por email. Dudas:
                    <a href="mailto:soporte@apunteshub.com" style="color:#08b894;text-decoration:none;">soporte@apunteshub.com</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = [
    title,
    "",
    `Hola ${input.sellerName}, se acreditó una venta en ApuntesHub.`,
    `${isCourse ? "Curso" : "Apunte"}: ${input.productTitle}`,
    `Detalle: ${input.productContext}`,
    `${buyerLabel}: ${input.buyerName}`,
    `Precio pagado: ${formatArs(input.amount)}`,
    `Comisión plataforma: ${formatArs(input.platformFee)}`,
    `Tu ingreso: ${formatArs(input.sellerAmount)}`,
    `Panel: ${input.dashboardUrl}`,
    `ID de pago: ${input.paymentId}`,
  ].join("\n");

  return { subject, html, text };
}

// ==========================================
// TUTORING EMAIL TEMPLATES
// ==========================================

interface TutorBookingEmailInput {
  tutorName: string;
  studentName: string;
  studentEmail?: string;
  subjectName: string;
  dateLabel: string;
  timeLabel: string;
  durationMinutes: number;
  modality: string;
  price: number;
  dashboardUrl: string;
  calendarUrl: string;
}

export function buildTutorBookingEmail(input: TutorBookingEmailInput) {
  const subject = "Nueva clase reservada en ApuntesHub";
  const category = "NUEVA RESERVA";
  const isOnline = input.modality === "online";

  const reminderText = isOnline
    ? "Recordá cargar el link de Meet o la plataforma que uses para la clase desde tu panel."
    : "Recordá cargar o coordinar el lugar de encuentro desde tu panel.";

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;background:#eaf1f7;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#111b3a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td align="center">
              <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="width:100%;max-width:520px;border-collapse:collapse;background:#ffffff;border:1px solid #dbe4ef;">
                <tr>
                  <td align="center" style="background:#091735;padding:44px 24px;">
                    <div style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;">
                      apuntes<span style="color:#08d6ad;">HUB</span><span style="color:#08d6ad;">.</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 32px 28px;">
                    <p style="margin:0 0 24px;color:#60708a;font-size:13px;letter-spacing:0.14em;">${category}</p>
                    <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#111b3a;">¡Tenés una nueva clase programada!</h1>
                    <p style="margin:0 0 22px;color:#43536d;font-size:15px;line-height:1.65;">
                      Hola ${escapeHtml(input.tutorName)}, <strong>${escapeHtml(input.studentName)}</strong> reservó y pagó una clase de ${escapeHtml(input.subjectName)}.
                      <br><br>
                      <span style="color:#08b894;font-weight:600;">${reminderText}</span>
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:8px 0 28px;">
                      ${summaryRow("Alumno", input.studentName + (input.studentEmail ? ` (${input.studentEmail})` : ""))}
                      ${summaryRow("Materia", input.subjectName)}
                      ${summaryRow("Fecha", input.dateLabel)}
                      ${summaryRow("Horario", input.timeLabel)}
                      ${summaryRow("Duración", `${input.durationMinutes} minutos`)}
                      ${summaryRow("Modalidad", input.modality)}
                      ${summaryRow("Precio de reserva", formatArs(input.price), true)}
                    </table>

                    <div style="text-align:center;margin:28px 0 26px;">
                      <a href="${input.dashboardUrl}" style="display:inline-block;background:#08d6ad;color:#071713;text-decoration:none;font-size:14px;font-weight:800;padding:15px 34px;border-radius:7px;">
                        Ver panel de clases
                      </a>
                    </div>
                    <div style="text-align:center;margin:0 0 26px;">
                      <a href="${input.calendarUrl}" style="display:inline-block;background:#ffffff;color:#111b3a;text-decoration:none;font-size:14px;font-weight:800;padding:14px 28px;border-radius:7px;border:1px solid #dbe4ef;">
                        Agendar en Google Calendar
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = [
    "Nueva clase reservada en ApuntesHub",
    "",
    `Hola ${input.tutorName}, ${input.studentName} reservó y pagó una clase de ${input.subjectName}.`,
    reminderText,
    "",
    `Alumno: ${input.studentName} ${input.studentEmail ? `(${input.studentEmail})` : ""}`,
    `Fecha: ${input.dateLabel}`,
    `Horario: ${input.timeLabel}`,
    `Duración: ${input.durationMinutes} minutos`,
    `Modalidad: ${input.modality}`,
    `Panel: ${input.dashboardUrl}`,
    `Google Calendar: ${input.calendarUrl}`,
  ].join("\n");

  return { subject, html, text };
}

interface StudentBookingEmailInput {
  studentName: string;
  tutorName: string;
  subjectName: string;
  dateLabel: string;
  timeLabel: string;
  durationMinutes: number;
  modality: string;
  price: number;
  successUrl: string;
  meetingUrl?: string | null;
  locationDetails?: string | null;
}

export function buildStudentBookingEmail(input: StudentBookingEmailInput) {
  const subject = "Tu clase fue reservada";
  const category = "RESERVA CONFIRMADA";
  
  const hasDetails = Boolean(input.meetingUrl || input.locationDetails);
  const infoText = hasDetails 
    ? "El profesor ya incluyó los datos de acceso para la clase:"
    : "El profesor te enviará los datos de la clase (link o lugar) cuando estén disponibles.";

  const detailsBox = hasDetails
    ? `<div style="background:#f4f7fa;padding:16px;border-radius:8px;margin-bottom:24px;">
         <p style="margin:0;color:#111b3a;font-size:14px;font-weight:600;">
           ${input.meetingUrl ? `Link de Meet: <a href="${input.meetingUrl}" style="color:#08b894;">${input.meetingUrl}</a>` : ""}
           ${input.locationDetails ? `Lugar: ${escapeHtml(input.locationDetails)}` : ""}
         </p>
       </div>`
    : "";

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;background:#eaf1f7;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#111b3a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td align="center">
              <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="width:100%;max-width:520px;border-collapse:collapse;background:#ffffff;border:1px solid #dbe4ef;">
                <tr>
                  <td align="center" style="background:#091735;padding:44px 24px;">
                    <div style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;">
                      apuntes<span style="color:#08d6ad;">HUB</span><span style="color:#08d6ad;">.</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 32px 28px;">
                    <p style="margin:0 0 24px;color:#60708a;font-size:13px;letter-spacing:0.14em;">${category}</p>
                    <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#111b3a;">¡Clase confirmada!</h1>
                    <p style="margin:0 0 22px;color:#43536d;font-size:15px;line-height:1.65;">
                      Hola ${escapeHtml(input.studentName)}, tu pago se acreditó y la clase de ${escapeHtml(input.subjectName)} con el profesor <strong>${escapeHtml(input.tutorName)}</strong> ya está programada.
                      <br><br>
                      ${infoText}
                    </p>

                    ${detailsBox}

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:8px 0 28px;">
                      ${summaryRow("Profesor", input.tutorName)}
                      ${summaryRow("Fecha", input.dateLabel)}
                      ${summaryRow("Horario", input.timeLabel)}
                      ${summaryRow("Duración", `${input.durationMinutes} minutos`)}
                      ${summaryRow("Modalidad", input.modality)}
                      ${summaryRow("Precio pagado", formatArs(input.price), true)}
                    </table>

                    <div style="text-align:center;margin:28px 0 26px;">
                      <a href="${input.successUrl}" style="display:inline-block;background:#08d6ad;color:#071713;text-decoration:none;font-size:14px;font-weight:800;padding:15px 34px;border-radius:7px;">
                        Ver detalles de mi reserva
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = [
    "Tu clase fue reservada",
    "",
    `Hola ${input.studentName}, tu clase de ${input.subjectName} con ${input.tutorName} está confirmada.`,
    infoText,
    "",
    `Fecha: ${input.dateLabel}`,
    `Horario: ${input.timeLabel}`,
    `Link de tu reserva: ${input.successUrl}`
  ].join("\n");

  return { subject, html, text };
}

interface StudentBookingDetailsEmailInput {
  studentName: string;
  tutorName: string;
  subjectName: string;
  dateLabel: string;
  timeLabel: string;
  meetingUrl?: string | null;
  locationDetails?: string | null;
  successUrl: string;
}

export function buildStudentBookingDetailsEmail(input: StudentBookingDetailsEmailInput) {
  const subject = "Ya están los datos de tu clase";
  const category = "ACTUALIZACIÓN DE RESERVA";
  
  const detailsBox = `<div style="background:#f4f7fa;padding:16px;border-radius:8px;margin-bottom:24px;">
    <p style="margin:0;color:#111b3a;font-size:14px;font-weight:600;">
      ${input.meetingUrl ? `Link de Meet: <a href="${input.meetingUrl}" style="color:#08b894;">${input.meetingUrl}</a>` : ""}
      ${input.locationDetails ? `Lugar: ${escapeHtml(input.locationDetails)}` : ""}
    </p>
  </div>`;

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;background:#eaf1f7;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#111b3a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td align="center">
              <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="width:100%;max-width:520px;border-collapse:collapse;background:#ffffff;border:1px solid #dbe4ef;">
                <tr>
                  <td align="center" style="background:#091735;padding:44px 24px;">
                    <div style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;">
                      apuntes<span style="color:#08d6ad;">HUB</span><span style="color:#08d6ad;">.</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 32px 28px;">
                    <p style="margin:0 0 24px;color:#60708a;font-size:13px;letter-spacing:0.14em;">${category}</p>
                    <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#111b3a;">El profesor cargó los datos de la clase</h1>
                    <p style="margin:0 0 22px;color:#43536d;font-size:15px;line-height:1.65;">
                      Hola ${escapeHtml(input.studentName)}, <strong>${escapeHtml(input.tutorName)}</strong> agregó los detalles de acceso para tu clase de ${escapeHtml(input.subjectName)} del ${input.dateLabel} a las ${input.timeLabel} hs.
                    </p>

                    ${detailsBox}

                    <div style="text-align:center;margin:28px 0 26px;">
                      <a href="${input.successUrl}" style="display:inline-block;background:#08d6ad;color:#071713;text-decoration:none;font-size:14px;font-weight:800;padding:15px 34px;border-radius:7px;">
                        Revisar reserva completa
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = [
    "Ya están los datos de tu clase",
    "",
    `Hola ${input.studentName}, el profesor cargó los datos de la clase de ${input.subjectName}.`,
    `Fecha: ${input.dateLabel} a las ${input.timeLabel} hs`,
    `Link de tu reserva: ${input.successUrl}`
  ].join("\n");

  return { subject, html, text };
}

// ==========================================
// MATERIAL QUESTIONS EMAIL TEMPLATES
// ==========================================

interface OwnerNewMaterialQuestionEmailInput {
  ownerName: string;
  studentName: string;
  materialKind: "resume" | "course";
  materialTitle: string;
  questionTitle: string;
  contextLabel: string | null;
  dashboardUrl: string;
}

export function buildOwnerNewMaterialQuestionEmail(
  input: OwnerNewMaterialQuestionEmailInput
) {
  const isCourse = input.materialKind === "course";
  const kindLabel = isCourse ? "curso" : "apunte";
  const subject = `Nueva consulta en tu ${kindLabel} "${input.materialTitle}"`;
  const category = "NUEVA CONSULTA";

  const contextRow = input.contextLabel
    ? summaryRow("Contexto", input.contextLabel)
    : "";

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;background:#eaf1f7;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#111b3a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td align="center">
              <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="width:100%;max-width:520px;border-collapse:collapse;background:#ffffff;border:1px solid #dbe4ef;">
                <tr>
                  <td align="center" style="background:#091735;padding:44px 24px;">
                    <div style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;">
                      apuntes<span style="color:#08d6ad;">HUB</span><span style="color:#08d6ad;">.</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 32px 28px;">
                    <p style="margin:0 0 24px;color:#60708a;font-size:13px;letter-spacing:0.14em;">${category}</p>
                    <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#111b3a;">
                      ${escapeHtml(input.studentName)} dejó una consulta en tu ${kindLabel}
                    </h1>
                    <p style="margin:0 0 22px;color:#43536d;font-size:15px;line-height:1.65;">
                      Hola ${escapeHtml(input.ownerName)}, podés revisarla y responder oficialmente desde tu panel.
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:8px 0 28px;">
                      ${summaryRow(isCourse ? "Curso" : "Apunte", input.materialTitle)}
                      ${summaryRow("Título de la consulta", input.questionTitle)}
                      ${contextRow}
                    </table>

                    <div style="text-align:center;margin:28px 0 26px;">
                      <a href="${input.dashboardUrl}" style="display:inline-block;background:#08d6ad;color:#071713;text-decoration:none;font-size:14px;font-weight:800;padding:15px 34px;border-radius:7px;">
                        Responder consulta
                      </a>
                    </div>

                    <p style="margin:0;color:#8a99b1;font-size:12px;line-height:1.65;">
                      Solo compradores con acceso al material pueden hacer estas consultas. Respondé desde el panel para que la respuesta quede registrada como oficial.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 32px;border-top:1px solid #e6ebf2;color:#8a99b1;font-size:12px;line-height:1.55;">
                    Por seguridad, nunca te pediremos claves por email. Dudas:
                    <a href="mailto:soporte@apunteshub.com" style="color:#08b894;text-decoration:none;">soporte@apunteshub.com</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = [
    `Nueva consulta en tu ${kindLabel} "${input.materialTitle}"`,
    "",
    `Hola ${input.ownerName}, ${input.studentName} dejó una consulta sobre tu ${kindLabel}.`,
    `Título: ${input.questionTitle}`,
    input.contextLabel ? `Contexto: ${input.contextLabel}` : "",
    `Responder: ${input.dashboardUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

interface BuyerMaterialQuestionAnsweredEmailInput {
  buyerName: string;
  materialKind: "resume" | "course";
  materialTitle: string;
  questionTitle: string;
  viewUrl: string;
  isMeTooReceiver?: boolean;
}

export function buildBuyerMaterialQuestionAnsweredEmail(
  input: BuyerMaterialQuestionAnsweredEmailInput
) {
  const isCourse = input.materialKind === "course";
  const kindLabel = isCourse ? "curso" : "apunte";
  const subject = input.isMeTooReceiver
    ? `Respondieron una consulta de "${input.materialTitle}" que también te interesaba`
    : `Respondieron tu consulta sobre "${input.materialTitle}"`;
  const category = input.isMeTooReceiver
    ? "CONSULTA QUE SEGUÍS"
    : "RESPUESTA OFICIAL";
  const heading = input.isMeTooReceiver
    ? `Hay una nueva respuesta en una consulta que marcaste como tuya`
    : `Respondieron tu consulta`;
  const lead = input.isMeTooReceiver
    ? `Hola ${escapeHtml(input.buyerName)}, hay una nueva respuesta oficial en una consulta de tu ${kindLabel} que también te interesaba.`
    : `Hola ${escapeHtml(input.buyerName)}, el responsable del ${kindLabel} respondió oficialmente tu consulta.`;

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;background:#eaf1f7;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#111b3a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td align="center">
              <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="width:100%;max-width:520px;border-collapse:collapse;background:#ffffff;border:1px solid #dbe4ef;">
                <tr>
                  <td align="center" style="background:#091735;padding:44px 24px;">
                    <div style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;">
                      apuntes<span style="color:#08d6ad;">HUB</span><span style="color:#08d6ad;">.</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 32px 28px;">
                    <p style="margin:0 0 24px;color:#60708a;font-size:13px;letter-spacing:0.14em;">${category}</p>
                    <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#111b3a;">${heading}</h1>
                    <p style="margin:0 0 22px;color:#43536d;font-size:15px;line-height:1.65;">${lead}</p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:8px 0 28px;">
                      ${summaryRow(isCourse ? "Curso" : "Apunte", input.materialTitle)}
                      ${summaryRow("Consulta", input.questionTitle)}
                    </table>

                    <div style="text-align:center;margin:28px 0 26px;">
                      <a href="${input.viewUrl}" style="display:inline-block;background:#08d6ad;color:#071713;text-decoration:none;font-size:14px;font-weight:800;padding:15px 34px;border-radius:7px;">
                        Ver la respuesta
                      </a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 32px;border-top:1px solid #e6ebf2;color:#8a99b1;font-size:12px;line-height:1.55;">
                    Por seguridad, nunca te pediremos claves por email. Dudas:
                    <a href="mailto:soporte@apunteshub.com" style="color:#08b894;text-decoration:none;">soporte@apunteshub.com</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = [
    subject,
    "",
    input.isMeTooReceiver
      ? `Hola ${input.buyerName}, hay una nueva respuesta oficial en una consulta de tu ${kindLabel} que también te interesaba.`
      : `Hola ${input.buyerName}, respondieron oficialmente tu consulta sobre "${input.materialTitle}".`,
    `Consulta: ${input.questionTitle}`,
    `Ver respuesta: ${input.viewUrl}`,
  ].join("\n");

  return { subject, html, text };
}

interface SupportRequestEmailInput {
  fromName?: string | null;
  fromEmail: string;
  topicLabel: string;
  message: string;
  userId?: string | null;
}

export function buildSupportRequestEmail(input: SupportRequestEmailInput) {
  const name = input.fromName?.trim() || "Alguien";
  const subject = `[Ayuda] ${input.topicLabel} — ${input.fromEmail}`;
  const category = "CENTRO DE AYUDA";

  const messageHtml = escapeHtml(input.message).replace(/\n/g, "<br />");
  const identityRow = input.userId
    ? summaryRow("Usuario", input.userId)
    : summaryRow("Usuario", "Sin sesión iniciada");

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;background:#eaf1f7;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#111b3a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td align="center">
              <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="width:100%;max-width:520px;border-collapse:collapse;background:#ffffff;border:1px solid #dbe4ef;">
                <tr>
                  <td align="center" style="background:#091735;padding:44px 24px;">
                    <div style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;">
                      apuntes<span style="color:#08d6ad;">HUB</span><span style="color:#08d6ad;">.</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 32px 28px;">
                    <p style="margin:0 0 24px;color:#60708a;font-size:13px;letter-spacing:0.14em;">${category}</p>
                    <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#111b3a;">
                      ${escapeHtml(name)} necesita una mano
                    </h1>
                    <p style="margin:0 0 22px;color:#43536d;font-size:15px;line-height:1.65;">
                      Respondé directo a este correo para contactar a la persona.
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:8px 0 24px;">
                      ${summaryRow("Tema", input.topicLabel)}
                      ${summaryRow("Email de contacto", input.fromEmail)}
                      ${identityRow}
                    </table>

                    <div style="background:#f4f7fb;border:1px solid #e6ebf2;border-radius:8px;padding:18px 20px;">
                      <p style="margin:0 0 8px;color:#60708a;font-size:12px;letter-spacing:0.1em;">MENSAJE</p>
                      <p style="margin:0;color:#111b3a;font-size:15px;line-height:1.7;">${messageHtml}</p>
                    </div>

                    <div style="text-align:center;margin:26px 0 6px;">
                      <a href="mailto:${escapeHtml(input.fromEmail)}" style="display:inline-block;background:#08d6ad;color:#071713;text-decoration:none;font-size:14px;font-weight:800;padding:15px 34px;border-radius:7px;">
                        Responder a ${escapeHtml(input.fromEmail)}
                      </a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 32px;border-top:1px solid #e6ebf2;color:#8a99b1;font-size:12px;line-height:1.55;">
                    Enviado desde el Centro de ayuda de apuntesHUB.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = [
    subject,
    "",
    `Tema: ${input.topicLabel}`,
    `Email de contacto: ${input.fromEmail}`,
    input.userId ? `Usuario: ${input.userId}` : "Usuario: sin sesión iniciada",
    "",
    "Mensaje:",
    input.message,
  ].join("\n");

  return { subject, html, text };
}
