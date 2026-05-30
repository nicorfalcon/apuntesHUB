import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  formatArs,
  buildSellerSaleEmail,
  buildTutorBookingEmail,
  buildStudentBookingEmail,
  buildStudentBookingDetailsEmail,
  buildOwnerNewMaterialQuestionEmail,
  buildBuyerMaterialQuestionAnsweredEmail,
} from "../templates";

/**
 * El criterio de los smoke tests es: ningún builder puede dejar la palabra
 * literal "undefined" en el output (catch común de branches rotas en
 * template literals), y los branches críticos (resume vs course, online vs
 * presencial, con vs sin detalles) tienen que reflejarse en el copy.
 *
 * No verificamos copy exacto: las strings de marketing pueden cambiar sin
 * que haya bug. Sí verificamos las funciones puras (escapeHtml, formatArs)
 * porque tienen lógica de seguridad / formato.
 */

describe("escapeHtml", () => {
  it("escapea & primero (no doble-escapea el resto)", () => {
    expect(escapeHtml("&<>\"")).toBe("&amp;&lt;&gt;&quot;");
  });

  it("neutraliza tags <script> (XSS clásico)", () => {
    const result = escapeHtml("<script>alert(1)</script>");
    expect(result).not.toContain("<script>");
    expect(result).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapea comillas dobles para atributos HTML", () => {
    expect(escapeHtml('onmouseover="evil()"')).toBe(
      "onmouseover=&quot;evil()&quot;"
    );
  });

  it("dado un string sin caracteres especiales, lo deja igual", () => {
    expect(escapeHtml("Juan Pérez")).toBe("Juan Pérez");
  });

  it("dado un string vacío, devuelve vacío", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("formatArs", () => {
  it("dado un entero, lo formatea con separador de miles", () => {
    expect(formatArs(1000)).toBe("$1.000 ARS");
  });

  it("dado un valor decimal, redondea al entero más cercano", () => {
    expect(formatArs(999.6)).toBe("$1.000 ARS");
    expect(formatArs(999.4)).toBe("$999 ARS");
  });

  it("dado un valor grande, usa separador de miles correctamente", () => {
    expect(formatArs(1234567)).toBe("$1.234.567 ARS");
  });

  it("dado 0, devuelve $0 ARS (no string vacío ni NaN)", () => {
    expect(formatArs(0)).toBe("$0 ARS");
  });
});

// ── Helpers de assertion para los smoke tests ────────────────────────────────

function expectNoUndefinedLiteral(strs: string[]) {
  for (const s of strs) {
    expect(s).not.toMatch(/\bundefined\b/);
  }
}

function expectNonEmpty(strs: string[]) {
  for (const s of strs) {
    expect(s.trim().length).toBeGreaterThan(0);
  }
}

// ── Builders ─────────────────────────────────────────────────────────────────

describe("buildSellerSaleEmail", () => {
  const base = {
    sellerName: "Juan",
    buyerName: "María",
    productTitle: "Análisis I",
    productContext: "Mate · ITBA",
    amount: 1000,
    platformFee: 100,
    sellerAmount: 900,
    paymentId: "pay-1",
    dashboardUrl: "https://app/dash",
  };

  it("kind=resume: usa 'apunte' en subject y body", () => {
    const r = buildSellerSaleEmail({ ...base, kind: "resume" });
    expectNonEmpty([r.subject, r.html, r.text]);
    expectNoUndefinedLiteral([r.subject, r.html, r.text]);
    expect(r.subject).toMatch(/apunte/i);
    expect(r.html).toMatch(/Comprador/);
  });

  it("kind=course: usa 'curso' en subject y 'Alumno' como label", () => {
    const r = buildSellerSaleEmail({ ...base, kind: "course" });
    expectNoUndefinedLiteral([r.subject, r.html, r.text]);
    expect(r.subject).toMatch(/curso/i);
    expect(r.html).toMatch(/Alumno/);
  });

  it("escapea HTML en el productTitle (no inyecta tags)", () => {
    const r = buildSellerSaleEmail({
      ...base,
      kind: "resume",
      productTitle: "<script>x</script>",
    });
    expect(r.html).not.toMatch(/<script>x<\/script>/);
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("incluye el monto formateado en ARS en el html", () => {
    const r = buildSellerSaleEmail({ ...base, kind: "resume" });
    expect(r.html).toContain("$1.000 ARS");
  });
});

describe("buildTutorBookingEmail", () => {
  const base = {
    tutorName: "Juan",
    studentName: "María",
    subjectName: "Análisis",
    dateLabel: "lunes 1 de junio",
    timeLabel: "14:00",
    durationMinutes: 60,
    price: 3500,
    dashboardUrl: "https://app/dash",
    calendarUrl: "https://cal/x",
  };

  it("modality=online: el reminder menciona 'link' o 'Meet'", () => {
    const r = buildTutorBookingEmail({ ...base, modality: "online" });
    expectNoUndefinedLiteral([r.subject, r.html, r.text]);
    expect(r.html).toMatch(/link|Meet|plataforma/i);
  });

  it("modality=presencial: el reminder menciona 'lugar'", () => {
    const r = buildTutorBookingEmail({ ...base, modality: "presencial" });
    expectNoUndefinedLiteral([r.subject, r.html, r.text]);
    expect(r.html).toMatch(/lugar/i);
  });

  it("studentEmail opcional: no rompe cuando es undefined", () => {
    const r = buildTutorBookingEmail({ ...base, modality: "online" });
    expectNoUndefinedLiteral([r.html, r.text]);
  });
});

describe("buildStudentBookingEmail", () => {
  const base = {
    studentName: "María",
    tutorName: "Juan",
    subjectName: "Análisis",
    dateLabel: "lunes 1 de junio",
    timeLabel: "14:00",
    durationMinutes: 60,
    modality: "online",
    price: 3500,
    successUrl: "https://app/s",
  };

  it("sin detalles del profe: muestra mensaje pendiente, no detalles vacíos", () => {
    const r = buildStudentBookingEmail({ ...base });
    expectNoUndefinedLiteral([r.html, r.text]);
    expect(r.html).toMatch(/enviará|disponibles/i);
  });

  it("con meetingUrl: el html incluye el link", () => {
    const r = buildStudentBookingEmail({
      ...base,
      meetingUrl: "https://meet.google.com/abc",
    });
    expectNoUndefinedLiteral([r.html, r.text]);
    expect(r.html).toContain("https://meet.google.com/abc");
  });

  it("con locationDetails: el html incluye la ubicación escapada", () => {
    const r = buildStudentBookingEmail({
      ...base,
      locationDetails: "Aula <404>",
    });
    expect(r.html).toContain("&lt;404&gt;");
    expect(r.html).not.toMatch(/Aula <404>/);
  });
});

describe("buildStudentBookingDetailsEmail", () => {
  const base = {
    studentName: "María",
    tutorName: "Juan",
    subjectName: "Análisis",
    dateLabel: "lunes 1 de junio",
    timeLabel: "14:00",
    successUrl: "https://app/s",
  };

  it("con meetingUrl: el html incluye el link", () => {
    const r = buildStudentBookingDetailsEmail({
      ...base,
      meetingUrl: "https://meet.google.com/x",
    });
    expectNoUndefinedLiteral([r.subject, r.html, r.text]);
    expect(r.html).toContain("https://meet.google.com/x");
  });

  it("sin meetingUrl ni locationDetails: no deja 'undefined' en el html", () => {
    const r = buildStudentBookingDetailsEmail({ ...base });
    expectNoUndefinedLiteral([r.subject, r.html, r.text]);
  });
});

describe("buildOwnerNewMaterialQuestionEmail", () => {
  const base = {
    ownerName: "Juan",
    studentName: "María",
    materialTitle: "Análisis I",
    questionTitle: "¿Cómo se resuelve esto?",
    contextLabel: "página 4",
    dashboardUrl: "https://app/dash",
  };

  it("materialKind=resume: usa 'apunte' en el copy", () => {
    const r = buildOwnerNewMaterialQuestionEmail({
      ...base,
      materialKind: "resume",
    });
    expectNoUndefinedLiteral([r.subject, r.html, r.text]);
    expect(r.html).toMatch(/apunte/i);
  });

  it("materialKind=course: usa 'curso' en el copy", () => {
    const r = buildOwnerNewMaterialQuestionEmail({
      ...base,
      materialKind: "course",
    });
    expectNoUndefinedLiteral([r.subject, r.html, r.text]);
    expect(r.html).toMatch(/curso/i);
  });

  it("contextLabel=null: no deja 'undefined' ni 'null' en el html", () => {
    const r = buildOwnerNewMaterialQuestionEmail({
      ...base,
      materialKind: "resume",
      contextLabel: null,
    });
    expect(r.html).not.toMatch(/\bundefined\b/);
    expect(r.html).not.toMatch(/\bnull\b/);
  });
});

describe("buildBuyerMaterialQuestionAnsweredEmail", () => {
  const base = {
    buyerName: "María",
    materialTitle: "Análisis I",
    questionTitle: "¿X?",
    viewUrl: "https://app/x",
  };

  it("materialKind=resume sin isMeTooReceiver: subject y body usan 'apunte'", () => {
    const r = buildBuyerMaterialQuestionAnsweredEmail({
      ...base,
      materialKind: "resume",
    });
    expectNoUndefinedLiteral([r.subject, r.html, r.text]);
    expect(r.html).toMatch(/apunte/i);
  });

  it("materialKind=course: usa 'curso' en el body", () => {
    const r = buildBuyerMaterialQuestionAnsweredEmail({
      ...base,
      materialKind: "course",
    });
    expectNoUndefinedLiteral([r.subject, r.html, r.text]);
    expect(r.html).toMatch(/curso/i);
  });

  it("isMeTooReceiver=true: el subject difiere del subject default", () => {
    const a = buildBuyerMaterialQuestionAnsweredEmail({
      ...base,
      materialKind: "resume",
    });
    const b = buildBuyerMaterialQuestionAnsweredEmail({
      ...base,
      materialKind: "resume",
      isMeTooReceiver: true,
    });
    expect(b.subject).not.toBe(a.subject);
  });
});
