import crypto from "crypto";

/**
 * Valida la firma HMAC-SHA256 del webhook de Mercado Pago.
 *
 * El manifest es `id:<dataId>;request-id:<xRequestId>;ts:<ts>;`, con los valores del header
 * `x-signature` (formato `ts=...,v1=...`).
 *
 * Dos detalles que hacían rebotar todas las notificaciones con 401:
 *   - El id va en MINÚSCULA.
 *   - El id sale del query param `data.id`, pero MP no siempre lo manda ahí: puede venir
 *     como `id`, o solo en el body. Cuando un valor no está, su segmento se OMITE del
 *     manifest; no se deja vacío (que es lo que hacíamos: `id:;...`).
 *
 * Por eso probamos los candidatos de id que tengamos (query y body) más la variante sin id.
 * Seguir exigiendo el secreto es lo que da la seguridad; probar candidatos no la debilita.
 */
export function validateSignature(
  xSignature: string,
  xRequestId: string,
  dataIds: (string | null | undefined) | (string | null | undefined)[]
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

  const candidates = (Array.isArray(dataIds) ? dataIds : [dataIds])
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .map((id) => id.toLowerCase());

  const manifests = [
    ...new Set([
      ...candidates.map((id) => `id:${id};request-id:${xRequestId};ts:${ts};`),
      `request-id:${xRequestId};ts:${ts};`,
    ]),
  ];

  return manifests.some((manifest) => {
    const computed = crypto
      .createHmac("sha256", secret)
      .update(manifest)
      .digest("hex");

    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, "hex"),
        Buffer.from(hash, "hex")
      );
    } catch {
      // El hash recibido no tiene el largo de un sha256: no es una firma válida.
      return false;
    }
  });
}
