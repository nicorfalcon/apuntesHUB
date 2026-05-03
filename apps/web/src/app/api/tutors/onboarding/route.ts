import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Modality = "online" | "presencial" | "ambas";

interface TutorSubjectInput {
  name?: string;
  university?: string;
  career?: string | null;
  hourly_rate_ars?: number;
  approval_proof_url?: string | null;
}

interface AvailabilityInput {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  modality?: Modality;
}

interface TutorOnboardingBody {
  bio?: string;
  subjects?: TutorSubjectInput[];
  availability?: AvailabilityInput[];
}

const VALID_MODALITIES = new Set<Modality>(["online", "presencial", "ambas"]);
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function validateBody(body: TutorOnboardingBody | null) {
  if (!body) return "El cuerpo de la solicitud no es válido.";

  const bio = normalizeText(body.bio);
  if (bio.length < 30 || bio.length > 1200) {
    return "La biografía debe tener entre 30 y 1200 caracteres.";
  }

  if (!Array.isArray(body.subjects) || body.subjects.length === 0) {
    return "Agregá al menos una materia.";
  }

  if (body.subjects.length > 8) {
    return "Podés publicar hasta 8 materias por ahora.";
  }

  for (const subject of body.subjects) {
    const name = normalizeText(subject.name);
    const university = normalizeText(subject.university);
    const rate = Number(subject.hourly_rate_ars);
    const proofUrl = normalizeText(subject.approval_proof_url);

    if (!name || !university) {
      return "Todas las materias necesitan nombre y universidad.";
    }

    if (!Number.isInteger(rate) || rate <= 0 || rate > 500000) {
      return "La tarifa por hora no es válida.";
    }

    if (proofUrl && !isValidUrl(proofUrl)) {
      return "El link del comprobante no es válido.";
    }
  }

  if (!Array.isArray(body.availability) || body.availability.length === 0) {
    return "Agregá al menos un horario disponible.";
  }

  if (body.availability.length > 24) {
    return "Podés publicar hasta 24 horarios por ahora.";
  }

  for (const slot of body.availability) {
    const day = Number(slot.day_of_week);
    const start = normalizeText(slot.start_time);
    const end = normalizeText(slot.end_time);

    if (!Number.isInteger(day) || day < 0 || day > 6) {
      return "Uno de los días seleccionados no es válido.";
    }

    if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end) || end <= start) {
      return "Uno de los horarios no es válido.";
    }

    if (!slot.modality || !VALID_MODALITIES.has(slot.modality)) {
      return "Una de las modalidades no es válida.";
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

  const body = (await request.json().catch(() => null)) as TutorOnboardingBody | null;
  const validationError = validateBody(body);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const admin = createAdminClient();
  const bio = normalizeText(body?.bio);
  const normalizedSubjects = (body?.subjects ?? []).map((subject) => ({
    name: normalizeText(subject.name),
    university: normalizeText(subject.university),
    career: normalizeText(subject.career) || null,
    hourly_rate_ars: Number(subject.hourly_rate_ars),
    approval_proof_url: normalizeText(subject.approval_proof_url) || null,
  }));
  const normalizedAvailability = (body?.availability ?? []).map((slot) => ({
    tutor_id: user.id,
    day_of_week: Number(slot.day_of_week),
    start_time: normalizeText(slot.start_time),
    end_time: normalizeText(slot.end_time),
    modality: slot.modality as Modality,
  }));

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      is_tutor: true,
      tutor_bio: bio,
    })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json(
      { error: "No pudimos actualizar tu perfil." },
      { status: 500 }
    );
  }

  const subjectIds: string[] = [];

  for (const subject of normalizedSubjects) {
    const { data, error } = await admin
      .from("subjects")
      .upsert(
        {
          name: subject.name,
          university: subject.university,
          career: subject.career,
        },
        { onConflict: "name,university" }
      )
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "No pudimos guardar una de las materias." },
        { status: 500 }
      );
    }

    subjectIds.push(data.id);

    const { error: tutorSubjectError } = await admin
      .from("tutor_subjects")
      .upsert(
        {
          tutor_id: user.id,
          subject_id: data.id,
          hourly_rate_ars: subject.hourly_rate_ars,
          approval_proof_url: subject.approval_proof_url,
          is_active: true,
        },
        { onConflict: "tutor_id,subject_id" }
      );

    if (tutorSubjectError) {
      return NextResponse.json(
        { error: "No pudimos asociar una materia a tu perfil." },
        { status: 500 }
      );
    }
  }

  const { data: existingTutorSubjects } = await admin
    .from("tutor_subjects")
    .select("subject_id")
    .eq("tutor_id", user.id);

  const subjectIdSet = new Set(subjectIds);
  const inactiveSubjectIds =
    existingTutorSubjects
      ?.map((subject) => subject.subject_id)
      .filter((subjectId) => !subjectIdSet.has(subjectId)) ?? [];

  if (inactiveSubjectIds.length > 0) {
    await admin
      .from("tutor_subjects")
      .update({ is_active: false })
      .eq("tutor_id", user.id)
      .in("subject_id", inactiveSubjectIds);
  }

  const { error: deleteAvailabilityError } = await admin
    .from("tutor_availability")
    .delete()
    .eq("tutor_id", user.id);

  if (deleteAvailabilityError) {
    return NextResponse.json(
      { error: "No pudimos actualizar tu disponibilidad." },
      { status: 500 }
    );
  }

  const { error: availabilityError } = await admin
    .from("tutor_availability")
    .insert(normalizedAvailability);

  if (availabilityError) {
    return NextResponse.json(
      { error: "No pudimos guardar tus horarios." },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "ok" });
}
