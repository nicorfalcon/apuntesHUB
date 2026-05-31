import { describe, it, expect, beforeEach, vi } from "vitest";

// El client de Backblaze (S3-compatible) envuelve el SDK de AWS. Mockeamos el
// SDK y el presigner para testear el cableado de la unidad sin tocar la red:
// que arme los comandos con bucket/key correctos, exija el env y normalice el body.
const h = vi.hoisted(() => ({
  send: vi.fn(),
  getSignedUrl: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  // Los comandos se instancian con `new`, así que deben ser constructores reales.
  const cmd = (name: string) =>
    class {
      __cmd = name;
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    };
  return {
    S3Client: class {
      send = h.send;
    },
    PutObjectCommand: cmd("Put"),
    GetObjectCommand: cmd("Get"),
    HeadObjectCommand: cmd("Head"),
    DeleteObjectCommand: cmd("Delete"),
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: h.getSignedUrl,
}));

const B2_ENV = {
  B2_BUCKET_NAME: "mi-bucket",
  B2_ENDPOINT: "https://s3.eu.backblazeb2.com",
  B2_REGION: "eu-central",
  B2_ACCESS_KEY_ID: "access-id",
  B2_SECRET_ACCESS_KEY: "secret-key",
};

// Re-importa el módulo fresco en cada test para resetear el cliente S3 cacheado
// a nivel de módulo (cachedClient).
async function loadClient() {
  vi.resetModules();
  return import("../client");
}

describe("backblaze client", () => {
  beforeEach(() => {
    h.send.mockReset();
    h.getSignedUrl.mockReset();
    for (const [k, v] of Object.entries(B2_ENV)) vi.stubEnv(k, v);
  });

  it("createCourseVideoUploadUrl arma un PutObjectCommand con bucket/key/contentType y devuelve la URL firmada", async () => {
    h.getSignedUrl.mockResolvedValue("https://signed-upload");
    const { createCourseVideoUploadUrl } = await loadClient();

    const url = await createCourseVideoUploadUrl({
      key: "videos/clase.mp4",
      contentType: "video/mp4",
      size: 123,
    });

    expect(url).toBe("https://signed-upload");
    const [, command, opts] = h.getSignedUrl.mock.calls[0];
    expect(command).toMatchObject({
      __cmd: "Put",
      input: { Bucket: "mi-bucket", Key: "videos/clase.mp4", ContentType: "video/mp4" },
    });
    // Expiración acotada (15 min).
    expect(opts.expiresIn).toBe(15 * 60);
  });

  it("createCourseVideoReadUrl arma un GetObjectCommand y firma con expiración de lectura (20 min)", async () => {
    h.getSignedUrl.mockResolvedValue("https://signed-read");
    const { createCourseVideoReadUrl } = await loadClient();

    const url = await createCourseVideoReadUrl("videos/clase.mp4");

    expect(url).toBe("https://signed-read");
    const [, command, opts] = h.getSignedUrl.mock.calls[0];
    expect(command).toMatchObject({ __cmd: "Get", input: { Key: "videos/clase.mp4" } });
    expect(opts.expiresIn).toBe(20 * 60);
  });

  it("readPrivateObjectBytes usa transformToByteArray cuando está disponible", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    h.send.mockResolvedValue({
      Body: { transformToByteArray: async () => bytes },
    });
    const { readPrivateObjectBytes } = await loadClient();

    const result = await readPrivateObjectBytes("k");

    expect(result).toEqual(bytes);
  });

  it("readPrivateObjectText decodifica los bytes a utf8", async () => {
    h.send.mockResolvedValue({
      Body: { transformToByteArray: async () => new TextEncoder().encode("hola") },
    });
    const { readPrivateObjectText } = await loadClient();

    expect(await readPrivateObjectText("k")).toBe("hola");
  });

  it("readPrivateObjectBytes lanza si el objeto no tiene body", async () => {
    h.send.mockResolvedValue({ Body: undefined });
    const { readPrivateObjectBytes } = await loadClient();

    await expect(readPrivateObjectBytes("k")).rejects.toThrow(
      "El objeto privado no tiene body."
    );
  });

  it("deleteCourseVideo envía un DeleteObjectCommand con la key", async () => {
    h.send.mockResolvedValue({});
    const { deleteCourseVideo } = await loadClient();

    await deleteCourseVideo("videos/vieja.mp4");

    const [command] = h.send.mock.calls[0];
    expect(command).toMatchObject({ __cmd: "Delete", input: { Key: "videos/vieja.mp4" } });
  });

  it("dado que falta una variable de entorno, entonces lanza con mensaje claro", async () => {
    vi.stubEnv("B2_BUCKET_NAME", "");
    const { createCourseVideoReadUrl } = await loadClient();

    await expect(createCourseVideoReadUrl("k")).rejects.toThrow(
      "Falta configurar B2_BUCKET_NAME"
    );
  });
});
