import { describe, it, expect } from "vitest";
import { generateGoogleCalendarUrl, generateIcsContent } from "../calendar";

const baseParams = {
  title: "Final de Algoritmos",
  description: "Llevar calculadora",
  location: "Aula Magna",
  startDate: new Date("2026-05-12T14:00:00Z"),
  durationMinutes: 60,
};

describe("generateGoogleCalendarUrl", () => {
  it("apunta al endpoint de Google Calendar con action=TEMPLATE", () => {
    // when
    const url = new URL(generateGoogleCalendarUrl(baseParams));

    // then
    expect(url.origin + url.pathname).toBe(
      "https://calendar.google.com/calendar/render"
    );
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
  });

  it("codifica título, descripción y ubicación como parámetros", () => {
    // when
    const url = new URL(generateGoogleCalendarUrl(baseParams));

    // then
    expect(url.searchParams.get("text")).toBe("Final de Algoritmos");
    expect(url.searchParams.get("details")).toBe("Llevar calculadora");
    expect(url.searchParams.get("location")).toBe("Aula Magna");
  });

  it("calcula la fecha de fin sumando la duración a la de inicio", () => {
    // given: inicio 14:00Z + 60 min -> fin 15:00Z
    // when
    const url = new URL(generateGoogleCalendarUrl(baseParams));

    // then
    expect(url.searchParams.get("dates")).toBe(
      "20260512T140000Z/20260512T150000Z"
    );
  });
});

describe("generateIcsContent", () => {
  it("genera un evento ICS válido con apertura y cierre de VCALENDAR/VEVENT", () => {
    // when
    const ics = generateIcsContent({ ...baseParams, uid: "evento-123" });
    const lines = ics.split("\r\n");

    // then
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("BEGIN:VEVENT");
    expect(lines).toContain("END:VEVENT");
    expect(lines[lines.length - 1]).toBe("END:VCALENDAR");
  });

  it("usa el uid provisto en lugar de generar uno aleatorio", () => {
    // given: inyectamos el uid para que el test sea determinístico
    // (no testeamos crypto.randomUUID; controlamos la aleatoriedad pasando el valor)
    const ics = generateIcsContent({ ...baseParams, uid: "evento-123" });

    // then
    expect(ics).toContain("UID:evento-123@apunteshub.com");
  });

  it("usa las separaciones de línea CRLF que exige el formato ICS", () => {
    const ics = generateIcsContent({ ...baseParams, uid: "evento-123" });
    expect(ics).toContain("\r\n");
  });

  it("incluye DTSTART y DTEND derivados de la duración", () => {
    const ics = generateIcsContent({ ...baseParams, uid: "evento-123" });
    expect(ics).toContain("DTSTART:20260512T140000Z");
    expect(ics).toContain("DTEND:20260512T150000Z");
  });

  it("escapa los caracteres especiales (coma, punto y coma, backslash) en los campos de texto", () => {
    // given
    const ics = generateIcsContent({
      ...baseParams,
      title: "Mate; Física, Química\\Lab",
      uid: "evento-123",
    });

    // then
    expect(ics).toContain("SUMMARY:Mate\\; Física\\, Química\\\\Lab");
  });

  it("genera un DTSTAMP con formato de timestamp ICS", () => {
    // El DTSTAMP usa la hora actual (no determinística), así que en vez de un valor
    // exacto verificamos que respete el formato YYYYMMDDTHHMMSSZ.
    const ics = generateIcsContent({ ...baseParams, uid: "evento-123" });
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });
});
