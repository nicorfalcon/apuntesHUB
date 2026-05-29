import crypto from "crypto";

/**
 * Valida la firma HMAC-SHA256 del webhook de Mercado Pago.
 *
 * Construye el manifest `id:<dataId>;request-id:<xRequestId>;ts:<ts>;` con los
 * valores del header `x-signature` (formato `ts=...,v1=...`) y lo compara contra
 * el hash recibido usando comparación de tiempo constante.
 */
export function validateSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string | null
): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.error("MP_WEBHOOK_SECRET no configurado");
    return false;
  }

  // Parsear ts y v1 del header x-signature
  const parts = xSignature.split(",");
  let ts: string | null = null;
  let hash: string | null = null;

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key?.trim() === "ts") ts = value?.trim() ?? null;
    if (key?.trim() === "v1") hash = value?.trim() ?? null;
  }

  if (!ts || !hash) return false;

  // Construir manifest y calcular HMAC
  const manifest = `id:${dataId ?? ""};request-id:${xRequestId};ts:${ts};`;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(computed, "hex"),
    Buffer.from(hash, "hex")
  );
}
