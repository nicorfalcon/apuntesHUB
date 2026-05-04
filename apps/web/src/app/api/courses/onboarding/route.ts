import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CourseType = "curso_completo" | "repaso_final" | "resolucion_tps";

interface CourseModuleInput {
  client_id?: string;
  title?: string;
  description?: string | null;
  duration_minutes?: number;
}

interface CourseOnboardingBody {
  title?: string;
  description?: string | null;
  course_type?: CourseType;
  subject?: {
    name?: string;
    university?: string;
    career?: string | null;
  };
  cover_color?: string | null;
  cover_image_url?: string | null;
  price_ars?: number;
  is_published?: boolean;
  modules?: CourseModuleInput[];
}

const VALID_COURSE_TYPES = new Set<CourseType>([
  "curso_completo",
  "repaso_final",
  "resolucion_tps",
]);
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validateBody(body: CourseOnboardingBody | null) {
  if (!body) return "El cuerpo de la solicitud no es válido.";

  const title = normalizeText(body.title);
  if (title.length < 6 || title.length > 120) {
    return "El título debe tener entre 6 y 120 caracteres.";
  }

  const description = normalizeText(body.description);
  if (description.length > 1600) {
    return "La descripción es demasiado larga.";
  }

  if (!body.course_type || !VALID_COURSE_TYPES.has(body.course_type)) {
    return "El tipo de curso no es válido.";
  }

  const subjectName = normalizeText(body.subject?.name);
  const university = normalizeText(body.subject?.university);
  if (!subjectName || !university) {
    return "Completá materia y universidad.";
  }

  const price = Number(body.price_ars);
  if (!Number.isInteger(price) || price <= 0 || price > 2000000) {
    return "El precio del curso no es válido.";
  }

  const coverColor = normalizeText(body.cover_color) || "#263833";
  if (!HEX_COLOR_PATTERN.test(coverColor)) {
    return "El color de portada no es válido.";
  }

  const coverImageUrl = normalizeText(body.cover_image_url);
  if (coverImageUrl.length > 2048) {
    return "La URL de la portada es demasiado larga.";
  }

  if (!Array.isArray(body.modules) || body.modules.length === 0) {
    return "Agregá al menos un módulo.";
  }

  if (body.modules.length > 40) {
    return "Podés cargar hasta 40 módulos por curso.";
  }

  for (const courseModule of body.modules) {
    const moduleTitle = normalizeText(courseModule.title);
    const durationMinutes = Number(courseModule.duration_minutes);

    if (moduleTitle.length < 3 || moduleTitle.length > 120) {
      return "Cada módulo necesita un título de entre 3 y 120 caracteres.";
    }

    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes <= 0 ||
      durationMinutes > 600
    ) {
      return "La duración de cada módulo debe estar entre 1 y 600 minutos.";
    }
  }

  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CourseOnboardingBody | null;
  const validationError = validateBody(body);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const admin = createAdminClient();
  const subjectPayload = {
    name: normalizeText(body?.subject?.name),
    university: normalizeText(body?.subject?.university),
    career: normalizeText(body?.subject?.career) || null,
  };

  const { data: subject, error: subjectError } = await admin
    .from("subjects")
    .upsert(subjectPayload, { onConflict: "name,university" })
    .select("id")
    .single();

  if (subjectError || !subject) {
    return NextResponse.json(
      { error: "No pudimos guardar la materia del curso." },
      { status: 500 }
    );
  }

  const publish = Boolean(body?.is_published);
  const { data: course, error: courseError } = await admin
    .from("recorded_courses")
    .insert({
      author_id: user.id,
      subject_id: subject.id,
      title: normalizeText(body?.title),
      description: normalizeText(body?.description) || null,
      course_type: body?.course_type as CourseType,
      cover_color: normalizeText(body?.cover_color) || "#263833",
      cover_image_url: normalizeText(body?.cover_image_url) || null,
      price_ars: Number(body?.price_ars),
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (courseError || !course) {
    return NextResponse.json(
      { error: "No pudimos crear el curso." },
      { status: 500 }
    );
  }

  const moduleInputs = body?.modules ?? [];
  const modules = moduleInputs.map((courseModule, index) => ({
    course_id: course.id,
    position: index + 1,
    title: normalizeText(courseModule.title),
    description: normalizeText(courseModule.description) || null,
    duration_seconds: Number(courseModule.duration_minutes) * 60,
  }));

  const { data: createdModules, error: modulesError } = await admin
    .from("course_modules")
    .insert(modules)
    .select("id, position");

  if (modulesError || !createdModules) {
    await admin.from("recorded_courses").delete().eq("id", course.id);
    return NextResponse.json(
      { error: "No pudimos guardar los módulos." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    course_id: course.id,
    modules: createdModules
      .sort((a, b) => a.position - b.position)
      .map((createdModule) => ({
        id: createdModule.id,
        position: createdModule.position,
        client_id: moduleInputs[createdModule.position - 1]?.client_id ?? null,
      })),
  });
}
