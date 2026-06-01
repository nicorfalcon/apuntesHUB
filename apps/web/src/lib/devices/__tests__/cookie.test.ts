import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  newDeviceId,
  signDeviceId,
  verifyDeviceId,
  hashIp,
  ipFromHeaders,
  getSessionIdFromAccessToken,
  parseUserAgentLabel,
} from "../cookie";

// signDeviceId/verifyDeviceId/hashIp leen process.env.DEVICE_COOKIE_SECRET
// (dependencia externa: configuración del entorno). Usamos un STUB con
// vi.stubEnv para fijar un secreto conocido de 32+ caracteres y que el test
// no dependa del entorno real de la máquina.
const SECRET = "0123456789abcdef0123456789abcdef"; // 32 chars

describe("signDeviceId / verifyDeviceId", () => {
  beforeEach(() => {
    vi.stubEnv("DEVICE_COOKIE_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("verifica el id que se firmó (round-trip)", () => {
    // given
    const id = "device-abc-123";

    // when
    const signed = signDeviceId(id);
    const result = verifyDeviceId(signed);

    // then
    expect(result).toBe(id);
  });

  it("produce el formato 'id.firma' separado por punto", () => {
    // when
    const signed = signDeviceId("dev-1");

    // then
    expect(signed.startsWith("dev-1.")).toBe(true);
    expect(signed.split(".")).toHaveLength(2);
  });

  it("devuelve null cuando la firma fue alterada", () => {
    // given: cambiamos el último carácter de la firma
    const signed = signDeviceId("dev-1");
    const alterado = signed.slice(0, -1) + (signed.endsWith("a") ? "b" : "a");

    // when / then
    expect(verifyDeviceId(alterado)).toBeNull();
  });

  it("devuelve null para una cookie vacía o sin punto separador", () => {
    expect(verifyDeviceId(null)).toBeNull();
    expect(verifyDeviceId(undefined)).toBeNull();
    expect(verifyDeviceId("")).toBeNull();
    expect(verifyDeviceId("sinpunto")).toBeNull();
  });

  it("devuelve null cuando el id no coincide con su firma original", () => {
    // given: firmamos un id pero pegamos la firma a otro id
    const firmaDeOtro = signDeviceId("dev-1").split(".")[1];

    // when / then
    expect(verifyDeviceId(`dev-2.${firmaDeOtro}`)).toBeNull();
  });
});

describe("hashIp", () => {
  beforeEach(() => {
    vi.stubEnv("DEVICE_COOKIE_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("es determinístico: la misma IP produce el mismo hash", () => {
    expect(hashIp("1.2.3.4")).toBe(hashIp("1.2.3.4"));
  });

  it("produce hashes distintos para IPs distintas", () => {
    expect(hashIp("1.2.3.4")).not.toBe(hashIp("5.6.7.8"));
  });

  it("devuelve un hash hex de 32 caracteres", () => {
    expect(hashIp("1.2.3.4")).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("ipFromHeaders", () => {
  it("toma la primera IP de x-forwarded-for (la del cliente)", () => {
    // given: la cadena de proxies pone primero al cliente
    const headers = new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" });

    // when / then
    expect(ipFromHeaders(headers)).toBe("1.1.1.1");
  });

  it("cae a x-real-ip cuando no hay x-forwarded-for", () => {
    const headers = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(ipFromHeaders(headers)).toBe("9.9.9.9");
  });

  it("devuelve null cuando no viene ninguna cabecera de IP", () => {
    expect(ipFromHeaders(new Headers())).toBeNull();
  });
});

describe("getSessionIdFromAccessToken", () => {
  // Helper: arma un JWT falso (no necesita firma válida; la unidad solo decodifica
  // el payload, la verificación real la hace Supabase en otro lado).
  function fakeJwt(payload: Record<string, unknown>): string {
    const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
    return `header.${b64}.signature`;
  }

  it("extrae el session_id del payload del token", () => {
    // given
    const token = fakeJwt({ session_id: "sess-123", sub: "user-1" });

    // when / then
    expect(getSessionIdFromAccessToken(token)).toBe("sess-123");
  });

  it("devuelve null cuando el token no trae session_id", () => {
    const token = fakeJwt({ sub: "user-1" });
    expect(getSessionIdFromAccessToken(token)).toBeNull();
  });

  it("devuelve null para token nulo, vacío o mal formado", () => {
    expect(getSessionIdFromAccessToken(null)).toBeNull();
    expect(getSessionIdFromAccessToken(undefined)).toBeNull();
    expect(getSessionIdFromAccessToken("")).toBeNull();
    expect(getSessionIdFromAccessToken("no-es-un-jwt")).toBeNull();
  });
});

describe("parseUserAgentLabel", () => {
  it.each([
    [
      "Chrome en Windows",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ],
    [
      "Firefox en macOS",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0",
    ],
    [
      "Chrome en Android",
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    ],
    [
      "Edge en Windows",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    ],
    [
      // El UA de iPhone contiene "like Mac OS X"; debe clasificarse como iOS,
      // no como macOS. Regresión del bug de orden de los chequeos de OS.
      "Safari en iOS",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    ],
  ])("devuelve '%s' para su User-Agent", (esperado, ua) => {
    expect(parseUserAgentLabel(ua)).toBe(esperado);
  });

  it("usa el hint de marca 'brave' aunque el UA se haga pasar por Chrome", () => {
    // given: Brave reporta un UA de Chrome; el hint del cliente lo desambigua
    const uaChrome =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    // when / then
    expect(parseUserAgentLabel(uaChrome, "brave")).toBe("Brave en Windows");
  });

  it("devuelve 'Dispositivo desconocido' cuando no hay User-Agent", () => {
    expect(parseUserAgentLabel(null)).toBe("Dispositivo desconocido");
    expect(parseUserAgentLabel(undefined)).toBe("Dispositivo desconocido");
    expect(parseUserAgentLabel("")).toBe("Dispositivo desconocido");
  });

  it("usa etiquetas de fallback cuando navegador y sistema son irreconocibles", () => {
    expect(parseUserAgentLabel("AgenteRaro/1.0")).toBe(
      "Navegador en sistema desconocido"
    );
  });
});

describe("newDeviceId", () => {
  // No stubeamos el secreto: newDeviceId solo usa crypto.randomUUID(), sin env.
  it("devuelve un UUID v4 con el formato canónico", () => {
    expect(newDeviceId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("genera valores únicos en llamadas sucesivas", () => {
    expect(newDeviceId()).not.toBe(newDeviceId());
  });
});

describe("getSecret (vía signDeviceId)", () => {
  // getSecret es interna; la ejercemos a través de signDeviceId, que es el primer
  // consumidor. Cualquier función que use el secreto compartiría la validación.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lanza error cuando DEVICE_COOKIE_SECRET no está definido", () => {
    // given
    vi.stubEnv("DEVICE_COOKIE_SECRET", "");
    delete process.env.DEVICE_COOKIE_SECRET;

    // when / then
    expect(() => signDeviceId("dev")).toThrow(/DEVICE_COOKIE_SECRET/);
  });

  it("lanza error cuando el secreto es demasiado corto (<32 chars)", () => {
    // given
    vi.stubEnv("DEVICE_COOKIE_SECRET", "corto");

    // when / then
    expect(() => signDeviceId("dev")).toThrow(/32\+ chars/);
  });
});
