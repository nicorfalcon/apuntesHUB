import { getPayPalApiBase } from "./config";
import { paypalHeaders } from "./client";
import { buildAuthAssertion } from "./auth-assertion";

export interface CapturedPayPalOrder {
  orderId: string;
  status: string; // COMPLETED, PENDING, DECLINED, ...
  /** id de la captura (equivalente al payment_id de MP). */
  captureId: string | null;
  /** custom_id de la purchase_unit (nuestra referencia interna). */
  customId: string | null;
  /** Estado de la captura individual (COMPLETED, DECLINED, PENDING...). */
  captureStatus: string | null;
}

/**
 * Captura una Order de PayPal previamente aprobada por el comprador.
 * Idempotente del lado de PayPal: capturar dos veces devuelve error ORDER_ALREADY_CAPTURED,
 * que tratamos como éxito consultando la orden.
 */
export async function capturePayPalOrder(
  orderId: string,
  sellerMerchantId: string
): Promise<CapturedPayPalOrder> {
  const headers = await paypalHeaders({
    "PayPal-Auth-Assertion": buildAuthAssertion(sellerMerchantId),
    // Idempotencia ante reintentos de red.
    "PayPal-Request-Id": `capture-${orderId}`,
  });

  const res = await fetch(
    `${getPayPalApiBase()}/v2/checkout/orders/${orderId}/capture`,
    { method: "POST", headers, body: "{}", cache: "no-store" }
  );

  const data = (await res.json().catch(() => ({}))) as PayPalOrderResource & {
    details?: Array<{ issue?: string }>;
  };

  // Si ya fue capturada, consultamos el estado actual en vez de fallar.
  if (!res.ok) {
    const alreadyCaptured = data.details?.some(
      (d) => d.issue === "ORDER_ALREADY_CAPTURED"
    );
    if (alreadyCaptured) {
      return await getPayPalOrder(orderId, sellerMerchantId);
    }
    throw new Error(
      `Error al capturar la orden de PayPal: ${res.status} - ${JSON.stringify(data)}`
    );
  }

  return parseOrderResource(data);
}

/** Consulta el estado actual de una orden (para reconciliar capturas ya hechas). */
export async function getPayPalOrder(
  orderId: string,
  sellerMerchantId: string
): Promise<CapturedPayPalOrder> {
  const headers = await paypalHeaders({
    "PayPal-Auth-Assertion": buildAuthAssertion(sellerMerchantId),
  });

  const res = await fetch(
    `${getPayPalApiBase()}/v2/checkout/orders/${orderId}`,
    { method: "GET", headers, cache: "no-store" }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Error al consultar la orden de PayPal: ${res.status} - ${detail}`);
  }

  return parseOrderResource((await res.json()) as PayPalOrderResource);
}

interface PayPalOrderResource {
  id?: string;
  status?: string;
  purchase_units?: Array<{
    custom_id?: string;
    payments?: {
      captures?: Array<{ id?: string; status?: string }>;
    };
  }>;
}

function parseOrderResource(data: PayPalOrderResource): CapturedPayPalOrder {
  const unit = data.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  return {
    orderId: data.id ?? "",
    status: data.status ?? "UNKNOWN",
    captureId: capture?.id ?? null,
    customId: unit?.custom_id ?? null,
    captureStatus: capture?.status ?? null,
  };
}
