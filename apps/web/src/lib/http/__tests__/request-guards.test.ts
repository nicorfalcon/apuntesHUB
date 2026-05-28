import { describe, it, expect } from "vitest";
import {
  isDocumentNavigationRequest,
  mediaEndpointNavigationResponse,
} from "../request-guards";

// Helper para construir un Request con headers arbitrarios sin repetir boilerplate.
function requestWithHeaders(headers: Record<string, string>) {
  return new Request("https://apunteshub.test/media", { headers });
}

describe("isDocumentNavigationRequest", () => {
  describe("detecta navegaciones de documento", () => {
    it("devuelve true cuando sec-fetch-dest es 'document'", () => {
      // given
      const request = requestWithHeaders({ "sec-fetch-dest": "document" });

      // when
      const result = isDocumentNavigationRequest(request);

      // then
      expect(result).toBe(true);
    });

    it("devuelve true cuando sec-fetch-dest es 'iframe'", () => {
      // given
      const request = requestWithHeaders({ "sec-fetch-dest": "iframe" });

      // when
      const result = isDocumentNavigationRequest(request);

      // then
      expect(result).toBe(true);
    });

    it("devuelve true cuando sec-fetch-mode es 'navigate'", () => {
      // given
      const request = requestWithHeaders({ "sec-fetch-mode": "navigate" });

      // when
      const result = isDocumentNavigationRequest(request);

      // then
      expect(result).toBe(true);
    });

    it("devuelve true cuando el header accept incluye text/html", () => {
      // given
      const request = requestWithHeaders({
        accept: "text/html,application/xhtml+xml",
      });

      // when
      const result = isDocumentNavigationRequest(request);

      // then
      expect(result).toBe(true);
    });
  });

  describe("no detecta navegaciones para pedidos de recursos", () => {
    it("devuelve false para un fetch de recurso (dest=empty, mode=cors, accept=json)", () => {
      // given
      const request = requestWithHeaders({
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        accept: "application/json",
      });

      // when
      const result = isDocumentNavigationRequest(request);

      // then
      expect(result).toBe(false);
    });

    it("devuelve false cuando no viene ninguno de los headers relevantes", () => {
      // given
      const request = requestWithHeaders({});

      // when
      const result = isDocumentNavigationRequest(request);

      // then
      expect(result).toBe(false);
    });
  });
});

describe("mediaEndpointNavigationResponse", () => {
  it("responde 404 con un cuerpo JSON de error", async () => {
    // when
    const response = mediaEndpointNavigationResponse();

    // then
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "No encontrado" });
  });
});
