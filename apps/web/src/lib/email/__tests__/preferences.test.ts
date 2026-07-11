import { describe, it, expect, vi } from "vitest";
import { wantsEmail } from "../preferences";

// El admin client se mockea en el borde: solo nos importa cómo interpretamos la fila.
function makeAdmin(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  return {
    admin: {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    } as never,
    maybeSingle,
  };
}

describe("wantsEmail", () => {
  it("dado que no hay fila de preferencias, entonces manda igual (default: recibir todo)", async () => {
    const { admin } = makeAdmin({ data: null, error: null });
    await expect(wantsEmail(admin, "u-1", "sales")).resolves.toBe(true);
  });

  it("dado que la consulta falla, entonces manda igual (no perder un aviso de venta)", async () => {
    const { admin } = makeAdmin({ data: null, error: { message: "boom" } });
    await expect(wantsEmail(admin, "u-1", "sales")).resolves.toBe(true);
  });

  it("dado que la familia está desactivada, entonces no manda", async () => {
    const { admin } = makeAdmin({
      data: {
        email_sales: false,
        email_material_questions: true,
        email_question_answers: true,
        email_tutoring: true,
      },
      error: null,
    });
    await expect(wantsEmail(admin, "u-1", "sales")).resolves.toBe(false);
  });

  it("dado que otra familia está desactivada, entonces la consultada sigue mandando", async () => {
    const { admin } = makeAdmin({
      data: {
        email_sales: false,
        email_material_questions: true,
        email_question_answers: true,
        email_tutoring: true,
      },
      error: null,
    });
    await expect(wantsEmail(admin, "u-1", "material_questions")).resolves.toBe(true);
    await expect(wantsEmail(admin, "u-1", "tutoring")).resolves.toBe(true);
  });
});
