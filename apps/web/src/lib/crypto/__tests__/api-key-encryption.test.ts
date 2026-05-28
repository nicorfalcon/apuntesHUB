import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encryptApiKey, decryptApiKey } from "../api-key-encryption";

// La unidad lee process.env.API_KEY_ENCRYPTION_SECRET (dependencia externa:
// configuración del entorno). Usamos un STUB con vi.stubEnv para fijar un valor
// conocido y que el test no dependa del entorno real de la máquina.
const SECRET = "0123456789abcdef0123456789abcdef"; // 32 chars

describe("encryptApiKey / decryptApiKey", () => {
  beforeEach(() => {
    vi.stubEnv("API_KEY_ENCRYPTION_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("round-trip", () => {
    it("desencripta al mismo texto que se encriptó", () => {
      // given
      const original = "sk-proj-clave-secreta-123";

      // when
      const { encrypted, iv } = encryptApiKey(original);
      const result = decryptApiKey(encrypted, iv);

      // then
      expect(result).toBe(original);
    });

    it("preserva un string vacío en el round-trip", () => {
      // given
      const original = "";

      // when
      const { encrypted, iv } = encryptApiKey(original);
      const result = decryptApiKey(encrypted, iv);

      // then
      expect(result).toBe("");
    });
  });

  describe("aleatoriedad del IV", () => {
    it("produce ciphertext distinto en cada llamada para el mismo texto", () => {
      // given
      const original = "misma-clave";

      // when: dos cifrados del mismo input
      const a = encryptApiKey(original);
      const b = encryptApiKey(original);

      // then: el IV aleatorio hace que el resultado difiera...
      expect(a.iv).not.toBe(b.iv);
      expect(a.encrypted).not.toBe(b.encrypted);

      // ...pero ambos desencriptan al mismo original
      expect(decryptApiKey(a.encrypted, a.iv)).toBe(original);
      expect(decryptApiKey(b.encrypted, b.iv)).toBe(original);
    });
  });

  describe("integridad (AES-GCM)", () => {
    it("falla al desencriptar si el ciphertext fue manipulado", () => {
      // given
      const { encrypted, iv } = encryptApiKey("clave-original");
      const [ciphertext, tag] = encrypted.split(":");
      const primerChar = ciphertext[0] === "a" ? "b" : "a";
      const manipulado = `${primerChar}${ciphertext.slice(1)}:${tag}`;

      // when / then: el authTag de GCM detecta la alteración
      expect(() => decryptApiKey(manipulado, iv)).toThrow();
    });
  });

  describe("validación del secreto", () => {
    it("lanza error si el secreto tiene menos de 32 caracteres", () => {
      // given: stub con un secreto demasiado corto
      vi.stubEnv("API_KEY_ENCRYPTION_SECRET", "corto");

      // when / then
      expect(() => encryptApiKey("algo")).toThrow(
        "API_KEY_ENCRYPTION_SECRET debe tener al menos 32 caracteres"
      );
    });
  });
});
