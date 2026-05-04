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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatArs(value: number) {
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
