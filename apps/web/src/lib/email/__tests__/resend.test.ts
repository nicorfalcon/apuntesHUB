import { describe, it, expect, beforeEach, vi } from "vitest";
import { sendTransactionalEmail } from "../resend";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.unstubAllEnvs();
});

const input = {
  to: "x@y.com",
  subject: "Asunto",
  html: "<p>h</p>",
  text: "h",
  idempotencyKey: "key-1",
};

describe("sendTransactionalEmail", () => {
  it("dado que no hay RESEND_API_KEY, entonces devuelve { skipped: true } sin llamar a Resend", async () => {
    const result = await sendTransactionalEmail(input);
    expect(result).toEqual({ skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dado un envío exitoso, entonces pega POST a Resend con Bearer + Idempotency-Key y devuelve el JSON", async () => {
    vi.stubEnv("RESEND_API_KEY", "rs-1");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "mail-1" }),
    });

    const result = await sendTransactionalEmail(input);
    expect(result).toEqual({ id: "mail-1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer rs-1",
      "Idempotency-Key": "key-1",
    });
    // El destinatario va como array (formato Resend).
    expect(JSON.parse(init.body).to).toEqual(["x@y.com"]);
  });

  it("dado RESEND_FROM seteado, entonces lo usa como from en lugar del default", async () => {
    vi.stubEnv("RESEND_API_KEY", "rs-1");
    vi.stubEnv("RESEND_FROM", "Custom <c@y.com>");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    await sendTransactionalEmail(input);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from).toBe("Custom <c@y.com>");
  });

  it("dado un response no ok, entonces lanza error con el status y detail", async () => {
    vi.stubEnv("RESEND_API_KEY", "rs-1");
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "bad recipient",
    });

    await expect(sendTransactionalEmail(input)).rejects.toThrow(
      /Resend error 400.*bad recipient/i
    );
  });
});
