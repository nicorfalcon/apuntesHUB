// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResumeForm } from "../resume-form";
import type { Resume } from "@/lib/database.types";
import { MAX_RESUME_TOPICS } from "@/lib/resumes/topics";

const h = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerRefresh: vi.fn(),
  toastSuccess: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  uploadToSignedUrl: vi.fn(),
}));

// El form sólo necesita estos stubs para los tests de UI de los chips de temas
// (no se ejercita el submit/guardado en estos casos).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.routerPush, refresh: h.routerRefresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: h.toastSuccess, error: vi.fn() },
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      insert: h.insert,
      update: h.update,
    }),
    storage: {
      from: () => ({
        uploadToSignedUrl: h.uploadToSignedUrl,
      }),
    },
  }),
}));

// Por label (estable): el placeholder cambia al deshabilitarse en el tope.
const topicInput = () => screen.getByLabelText(/Temas del apunte/i);

function chips() {
  // Cada chip tiene un botón "Quitar tema <x>"; devolvemos sus textos.
  return screen
    .queryAllByRole("button", { name: /Quitar tema/i })
    .map((btn) => btn.closest("span")?.textContent?.replace(/\s+/g, " ").trim());
}

function makeInitialResume(overrides: Partial<Resume> = {}): Resume {
  return {
    id: "r-edit",
    title: "Apunte original",
    description: "Descripción original",
    subject: "Química",
    university: "UBA",
    career: "Ingeniería",
    price: 1000,
    status: "published",
    seller_id: "u1",
    file_url: "u1/r-edit/original.pdf",
    preview_url: null,
    rating_avg: 0,
    rating_count: 0,
    topics: [],
    deleted_at: null,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function reindexCalls() {
  const fetchMock = vi.mocked(fetch);
  return fetchMock.mock.calls.filter(
    ([url]) => url === "/api/admin/search/reindex"
  );
}

async function fillRequiredInfo(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Título/i), "Resumen Química");
  await user.type(screen.getByLabelText(/Materia/i), "Química");
  await user.type(screen.getByLabelText(/Carrera/i), "Ingeniería");
  await user.type(screen.getByLabelText(/Universidad/i), "UBA");
}

async function submitNewResume(user: ReturnType<typeof userEvent.setup>) {
  await fillRequiredInfo(user);
  await user.type(topicInput(), "Le Chatelier{Enter}");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  const pdfInput = document.querySelector<HTMLInputElement>("input#pdf");
  expect(pdfInput).not.toBeNull();
  await user.upload(
    pdfInput as HTMLInputElement,
    new File(["pdf"], "apunte.pdf", { type: "application/pdf" })
  );
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.type(screen.getByLabelText(/Precio/i), "1500");
  await user.click(screen.getByRole("button", { name: "Publicar apunte" }));
}

async function submitEditedResume(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request) => {
      if (url === "/api/upload") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            path: "u1/new-resume-id/apunte.pdf",
            token: "signed-upload-token",
            publicUrl: null,
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, status: "indexed" }),
      };
    })
  );
  h.insert.mockResolvedValue({ error: null });
  h.update.mockReturnValue({ eq: h.updateEq });
  h.updateEq.mockResolvedValue({ error: null });
  h.uploadToSignedUrl.mockResolvedValue({ error: null });
});

describe("ResumeForm — Temas del apunte (chips)", () => {
  it("agrega un tema con Enter y lo muestra como chip", async () => {
    const user = userEvent.setup();
    render(<ResumeForm userId="u1" />);

    await user.type(topicInput(), "Le Chatelier{Enter}");

    expect(
      screen.getByRole("button", { name: /Quitar tema Le Chatelier/i })
    ).toBeInTheDocument();
    expect(topicInput()).toHaveValue("");
  });

  it("agrega varios temas separados por coma", async () => {
    const user = userEvent.setup();
    render(<ResumeForm userId="u1" />);

    await user.type(topicInput(), "sockets, scheduling,3FN{Enter}");

    const labels = chips();
    expect(labels).toContain("sockets");
    expect(labels).toContain("scheduling");
    expect(labels).toContain("3FN");
  });

  it("deduplica temas (case-insensitive) al agregar", async () => {
    const user = userEvent.setup();
    render(<ResumeForm userId="u1" />);

    await user.type(topicInput(), "Sockets{Enter}");
    await user.type(topicInput(), "sockets{Enter}");

    expect(
      screen.getAllByRole("button", { name: /Quitar tema/i })
    ).toHaveLength(1);
  });

  it("elimina un tema al hacer click en la X", async () => {
    const user = userEvent.setup();
    render(<ResumeForm userId="u1" />);

    await user.type(topicInput(), "presión{Enter}");
    const remove = screen.getByRole("button", { name: /Quitar tema presión/i });
    await user.click(remove);

    expect(
      screen.queryByRole("button", { name: /Quitar tema presión/i })
    ).not.toBeInTheDocument();
  });

  it("no permite más de MAX_RESUME_TOPICS: actualiza contador, deshabilita y avisa", async () => {
    const user = userEvent.setup();
    render(<ResumeForm userId="u1" />);

    // Pegamos una lista grande de golpe (bypassa el commit por-coma) y confirmamos
    // con Enter, para ejercitar el tope de cantidad en una sola operación.
    const input = topicInput();
    const many = Array.from(
      { length: MAX_RESUME_TOPICS + 3 },
      (_, i) => `tema-${i}`
    ).join(",");
    input.focus();
    await user.paste(many);
    await user.keyboard("{Enter}");

    expect(
      screen.getAllByRole("button", { name: /Quitar tema/i })
    ).toHaveLength(MAX_RESUME_TOPICS);
    expect(
      screen.getByText(`${MAX_RESUME_TOPICS}/${MAX_RESUME_TOPICS}`)
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`Máximo ${MAX_RESUME_TOPICS} temas`))
    ).toBeInTheDocument();
    // El input queda deshabilitado al llegar al tope.
    expect(topicInput()).toBeDisabled();
  });

  it("precarga los topics existentes en modo edición", () => {
    render(
      <ResumeForm
        userId="u1"
        initial={makeInitialResume({
          id: "r1",
          title: "Apunte",
          career: "Ing",
          price: 100,
          status: "draft",
          topics: ["Le Chatelier", "equilibrio químico"],
        })}
      />
    );

    const labels = chips();
    expect(labels).toContain("Le Chatelier");
    expect(labels).toContain("equilibrio químico");
  });

  it("guardar apunte nuevo dispara reindex puntual con el resumeId creado", async () => {
    const randomUUID = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("new-resume-id");
    const user = userEvent.setup();
    render(<ResumeForm userId="u1" />);

    await submitNewResume(user);

    await waitFor(() => expect(h.insert).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(reindexCalls()).toHaveLength(1));
    expect(JSON.parse(reindexCalls()[0][1]?.body as string)).toEqual({
      resumeId: "new-resume-id",
    });
    expect(h.toastSuccess).toHaveBeenCalledWith("Apunte publicado correctamente.");
    randomUUID.mockRestore();
  });

  it("editar apunte dispara reindex puntual con el resumeId existente", async () => {
    const user = userEvent.setup();
    render(<ResumeForm userId="u1" initial={makeInitialResume()} />);

    await user.clear(screen.getByLabelText(/Título/i));
    await user.type(screen.getByLabelText(/Título/i), "Apunte actualizado");
    await submitEditedResume(user);

    await waitFor(() => expect(h.updateEq).toHaveBeenCalledWith("id", "r-edit"));
    await waitFor(() => expect(reindexCalls()).toHaveLength(1));
    expect(JSON.parse(reindexCalls()[0][1]?.body as string)).toEqual({
      resumeId: "r-edit",
    });
  });

  it("editar topics guarda los nuevos temas y dispara reindex puntual", async () => {
    const user = userEvent.setup();
    render(
      <ResumeForm
        userId="u1"
        initial={makeInitialResume({ topics: ["Le Chatelier"] })}
      />
    );

    await user.type(topicInput(), "Equilibrio químico{Enter}");
    await submitEditedResume(user);

    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1));
    expect(h.update.mock.calls[0][0]).toMatchObject({
      topics: ["Le Chatelier", "Equilibrio químico"],
    });
    await waitFor(() => expect(reindexCalls()).toHaveLength(1));
    expect(JSON.parse(reindexCalls()[0][1]?.body as string)).toEqual({
      resumeId: "r-edit",
    });
  });

  it("si reindex falla, el guardado sigue exitoso y registra warning seguro", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("meili unavailable");
      })
    );
    const user = userEvent.setup();
    render(<ResumeForm userId="u1" initial={makeInitialResume()} />);

    await submitEditedResume(user);

    await waitFor(() => expect(h.updateEq).toHaveBeenCalledWith("id", "r-edit"));
    expect(h.toastSuccess).toHaveBeenCalledWith("Apunte actualizado correctamente.");
    expect(h.routerPush).toHaveBeenCalledWith("/sell/dashboard");
    await waitFor(() =>
      expect(warnSpy).toHaveBeenCalledWith(
        "[resume-form] search reindex failed",
        expect.objectContaining({
          resumeId: "r-edit",
          message: "meili unavailable",
        })
      )
    );
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("Le Chatelier");
    warnSpy.mockRestore();
  });

  it("no llama reindex si falla el guardado en Supabase", async () => {
    h.updateEq.mockResolvedValueOnce({ error: { message: "db failed" } });
    const user = userEvent.setup();
    render(<ResumeForm userId="u1" initial={makeInitialResume()} />);

    await submitEditedResume(user);

    await waitFor(() => expect(screen.getByText("db failed")).toBeInTheDocument());
    expect(reindexCalls()).toHaveLength(0);
    expect(h.toastSuccess).not.toHaveBeenCalled();
  });
});
