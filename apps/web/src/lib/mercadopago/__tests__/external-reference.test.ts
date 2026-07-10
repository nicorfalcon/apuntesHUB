import { describe, it, expect } from "vitest";
import { parseExternalReference } from "../external-reference";

describe("parseExternalReference", () => {
  it("reconoce una reserva de tutoría por su prefijo", () => {
    // when
    const result = parseExternalReference("tutoring_booking:uuid-123");

    // then
    expect(result).toEqual({ kind: "tutoring", id: "uuid-123" });
  });

  it("reconoce una inscripción a curso por su prefijo", () => {
    // when
    const result = parseExternalReference("course_enrollment:uuid-456");

    // then
    expect(result).toEqual({ kind: "course", id: "uuid-456" });
  });

  it("trata una referencia sin prefijo como compra de apunte", () => {
    // when
    const result = parseExternalReference("uuid-789");

    // then
    expect(result).toEqual({ kind: "purchase", id: "uuid-789" });
  });

  it("no confunde un prefijo parcial con una tutoría", () => {
    // given: 'tutoring_' no es el prefijo completo 'tutoring_booking:'
    const result = parseExternalReference("tutoring_uuid");

    // then: cae a compra (purchase) con el id completo
    expect(result).toEqual({ kind: "purchase", id: "tutoring_uuid" });
  });

  it("reconoce una orden (bundle o grupo de carrito) por su prefijo", () => {
    const result = parseExternalReference("order:uuid-abc");
    expect(result).toEqual({ kind: "order", id: "uuid-abc" });
  });
});
