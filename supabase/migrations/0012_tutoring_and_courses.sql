-- ============================================
-- Migración: tutoría y cursos grabados
-- Fecha: 2026-05-02
-- Autor: JeroDiLeo
-- TODO futuro: unificar resumes.subject (text) con subjects.id en migración aparte.
-- ============================================

begin;

-- ============================================
-- 1. Función helper updated_at (reusable)
-- ============================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger genérico BEFORE UPDATE para mantener updated_at = now() en cualquier tabla con esa columna.';

-- ============================================
-- 2. ALTER profiles — columnas de tutor
-- ============================================
alter table public.profiles
  add column if not exists is_tutor boolean not null default false,
  add column if not exists tutor_bio text,
  add column if not exists tutor_verified_at timestamptz,
  add column if not exists tutor_rating_avg numeric not null default 0,
  add column if not exists tutor_rating_count integer not null default 0;

comment on column public.profiles.is_tutor is
  'Marca ortogonal a role: un usuario puede ser seller Y tutor.';
comment on column public.profiles.tutor_verified_at is
  'Fecha en la que un admin acreditó al tutor (al menos una materia aprobada).';
comment on column public.profiles.tutor_rating_avg is
  'Desnormalización mantenida por trigger refresh_tutor_rating().';

-- ============================================
-- 3. subjects — materias normalizadas
-- ============================================
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  university text not null,
  career text,
  created_at timestamptz not null default now(),
  unique (name, university)
);

comment on table public.subjects is
  'Materias normalizadas usadas por tutor_subjects y recorded_courses. resumes.subject sigue siendo text (TODO unificar).';
comment on column public.subjects.career is
  'Nullable: una materia puede ser inter-carrera (ej. Análisis Matemático I).';

-- ============================================
-- 4. tutor_subjects — qué materia da cada tutor
-- ============================================
create table if not exists public.tutor_subjects (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  hourly_rate_ars integer not null check (hourly_rate_ars > 0),
  approved_at timestamptz,
  approval_proof_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tutor_id, subject_id)
);

comment on table public.tutor_subjects is
  'Materias que enseña un tutor con su tarifa por hora individual.';
comment on column public.tutor_subjects.approval_proof_url is
  'Link al analítico/certificado que prueba que el tutor aprobó esa materia.';
comment on column public.tutor_subjects.is_active is
  'El tutor puede pausar la oferta de una materia sin borrar el row.';

-- ============================================
-- 5. tutor_availability — slots semanales recurrentes
-- ============================================
create table if not exists public.tutor_availability (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  modality text not null check (modality in ('online','presencial','ambas')),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

comment on table public.tutor_availability is
  'Disponibilidad recurrente del tutor por día de la semana. day_of_week: 0=domingo, 6=sábado.';

-- ============================================
-- 6. tutor_bookings — solicitudes / reservas
-- ============================================
create table if not exists public.tutor_bookings (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  scheduled_at timestamptz,
  duration_minutes integer not null default 60,
  status text not null default 'requested'
    check (status in ('requested','confirmed','completed','cancelled')),
  initial_message text,
  hourly_rate_ars integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tutor_id <> student_id)
);

comment on table public.tutor_bookings is
  'Solicitudes de clase particular. Las transiciones de status se validan en código, no en SQL.';
comment on column public.tutor_bookings.scheduled_at is
  'Nullable hasta que el tutor confirma horario.';
comment on column public.tutor_bookings.hourly_rate_ars is
  'Snapshot de la tarifa al momento del booking (la tarifa del tutor puede cambiar después).';

-- ============================================
-- 7. tutor_messages — chat dentro del booking
-- ============================================
create table if not exists public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.tutor_bookings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.tutor_messages is
  'Mensajes alumno↔tutor agrupados por booking. read_at es el ack de lectura del receptor.';

-- ============================================
-- 8. tutor_reviews — reseñas de profes
-- ============================================
create table if not exists public.tutor_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.tutor_bookings(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tutor_id <> reviewer_id)
);

comment on table public.tutor_reviews is
  'Una review por booking completado. Tabla separada de public.reviews porque esa tiene FKs a resume_id/purchase_id.';

-- ============================================
-- 9. recorded_courses
-- ============================================
create table if not exists public.recorded_courses (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  title text not null,
  description text,
  course_type text not null
    check (course_type in ('curso_completo','repaso_final','resolucion_tps')),
  cover_color text default '#263833',
  cover_image_url text,
  price_ars integer not null check (price_ars > 0),
  total_duration_seconds integer not null default 0,
  rating_avg numeric not null default 0,
  rating_count integer not null default 0,
  is_published boolean not null default false,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recorded_courses is
  'Cursos grabados (contenedor de módulos). Soft delete vía deleted_at, igual que resumes.';
comment on column public.recorded_courses.total_duration_seconds is
  'Mantenido por trigger refresh_course_total_duration() sumando duration_seconds de course_modules.';
comment on column public.recorded_courses.subject_id is
  'ON DELETE RESTRICT: no permitimos borrar una materia si hay cursos atados.';

-- ============================================
-- 10. course_modules
-- ============================================
create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.recorded_courses(id) on delete cascade,
  position integer not null,
  title text not null,
  description text,
  duration_seconds integer not null default 0,
  video_storage_key text,
  video_duration_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position)
);

comment on table public.course_modules is
  'Módulos / clases dentro de un curso grabado.';
comment on column public.course_modules.video_storage_key is
  'Key del objeto en BackBlaze B2. Nullable hasta upload real (Etapa 5).';

-- ============================================
-- 11. course_enrollments — compras de cursos (estilo purchases)
-- ============================================
create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.recorded_courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null,
  platform_fee numeric not null default 0,
  seller_amount numeric not null default 0,
  status text not null default 'pending'
    check (status in ('pending','completed','refunded','failed')),
  payment_id text,
  mp_preference_id text,
  purchased_at timestamptz not null default now(),
  unique (course_id, student_id)
);

comment on table public.course_enrollments is
  'Inscripción / compra de curso grabado. Replica el modelo de purchases para reutilizar webhook MP.';

-- ============================================
-- 12. course_progress — avance por módulo
-- ============================================
create table if not exists public.course_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.course_enrollments(id) on delete cascade,
  module_id uuid not null references public.course_modules(id) on delete cascade,
  watched_seconds integer not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (enrollment_id, module_id)
);

comment on table public.course_progress is
  'Avance por módulo del alumno. Update cada ~10s desde el reproductor.';

-- ============================================
-- 13. course_reviews
-- ============================================
create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.course_enrollments(id) on delete cascade,
  course_id uuid not null references public.recorded_courses(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.course_reviews is
  'Una review por enrollment. Separada de public.reviews por las mismas razones que tutor_reviews.';

-- ============================================
-- 14. Indexes
-- ============================================
create index if not exists idx_profiles_is_tutor
  on public.profiles(is_tutor) where is_tutor = true;

create index if not exists idx_subjects_university
  on public.subjects(university);

create index if not exists idx_tutor_subjects_tutor
  on public.tutor_subjects(tutor_id);
create index if not exists idx_tutor_subjects_subject
  on public.tutor_subjects(subject_id);
create index if not exists idx_tutor_subjects_active
  on public.tutor_subjects(is_active) where is_active = true;

create index if not exists idx_tutor_availability_tutor_day
  on public.tutor_availability(tutor_id, day_of_week);

create index if not exists idx_tutor_bookings_tutor
  on public.tutor_bookings(tutor_id);
create index if not exists idx_tutor_bookings_student
  on public.tutor_bookings(student_id);
create index if not exists idx_tutor_bookings_subject
  on public.tutor_bookings(subject_id);
create index if not exists idx_tutor_bookings_status
  on public.tutor_bookings(status);

create index if not exists idx_tutor_messages_booking
  on public.tutor_messages(booking_id);
create index if not exists idx_tutor_messages_sender
  on public.tutor_messages(sender_id);

create index if not exists idx_tutor_reviews_tutor
  on public.tutor_reviews(tutor_id);
create index if not exists idx_tutor_reviews_reviewer
  on public.tutor_reviews(reviewer_id);

create index if not exists idx_recorded_courses_author
  on public.recorded_courses(author_id);
create index if not exists idx_recorded_courses_subject
  on public.recorded_courses(subject_id);
create index if not exists idx_recorded_courses_type
  on public.recorded_courses(course_type);
create index if not exists idx_recorded_courses_published
  on public.recorded_courses(is_published) where is_published = true;
create index if not exists idx_recorded_courses_deleted
  on public.recorded_courses(deleted_at);

create index if not exists idx_course_modules_course
  on public.course_modules(course_id);

create index if not exists idx_course_enrollments_course
  on public.course_enrollments(course_id);
create index if not exists idx_course_enrollments_student
  on public.course_enrollments(student_id);
create index if not exists idx_course_enrollments_status
  on public.course_enrollments(status);

create index if not exists idx_course_progress_enrollment
  on public.course_progress(enrollment_id);
create index if not exists idx_course_progress_module
  on public.course_progress(module_id);

create index if not exists idx_course_reviews_course
  on public.course_reviews(course_id);
create index if not exists idx_course_reviews_reviewer
  on public.course_reviews(reviewer_id);

-- ============================================
-- 15. ENABLE RLS + policies
-- ============================================

-- subjects
alter table public.subjects enable row level security;

drop policy if exists "Subjects: lectura pública" on public.subjects;
create policy "Subjects: lectura pública" on public.subjects
  for select using (true);

drop policy if exists "Subjects: insert por authenticated" on public.subjects;
create policy "Subjects: insert por authenticated" on public.subjects
  for insert with check (auth.role() = 'authenticated');

-- tutor_subjects
alter table public.tutor_subjects enable row level security;

drop policy if exists "Tutor_subjects: lectura pública" on public.tutor_subjects;
create policy "Tutor_subjects: lectura pública" on public.tutor_subjects
  for select using (true);

drop policy if exists "Tutor_subjects: insert por tutor" on public.tutor_subjects;
create policy "Tutor_subjects: insert por tutor" on public.tutor_subjects
  for insert with check (auth.uid() = tutor_id);

drop policy if exists "Tutor_subjects: update por tutor" on public.tutor_subjects;
create policy "Tutor_subjects: update por tutor" on public.tutor_subjects
  for update using (auth.uid() = tutor_id) with check (auth.uid() = tutor_id);

drop policy if exists "Tutor_subjects: delete por tutor" on public.tutor_subjects;
create policy "Tutor_subjects: delete por tutor" on public.tutor_subjects
  for delete using (auth.uid() = tutor_id);

-- tutor_availability
alter table public.tutor_availability enable row level security;

drop policy if exists "Tutor_availability: lectura pública" on public.tutor_availability;
create policy "Tutor_availability: lectura pública" on public.tutor_availability
  for select using (true);

drop policy if exists "Tutor_availability: insert por tutor" on public.tutor_availability;
create policy "Tutor_availability: insert por tutor" on public.tutor_availability
  for insert with check (auth.uid() = tutor_id);

drop policy if exists "Tutor_availability: update por tutor" on public.tutor_availability;
create policy "Tutor_availability: update por tutor" on public.tutor_availability
  for update using (auth.uid() = tutor_id) with check (auth.uid() = tutor_id);

drop policy if exists "Tutor_availability: delete por tutor" on public.tutor_availability;
create policy "Tutor_availability: delete por tutor" on public.tutor_availability
  for delete using (auth.uid() = tutor_id);

-- tutor_bookings
alter table public.tutor_bookings enable row level security;

drop policy if exists "Tutor_bookings: lectura por involucrado" on public.tutor_bookings;
create policy "Tutor_bookings: lectura por involucrado" on public.tutor_bookings
  for select using (auth.uid() in (tutor_id, student_id));

drop policy if exists "Tutor_bookings: insert por student" on public.tutor_bookings;
create policy "Tutor_bookings: insert por student" on public.tutor_bookings
  for insert with check (auth.uid() = student_id and student_id <> tutor_id);

drop policy if exists "Tutor_bookings: update por involucrado" on public.tutor_bookings;
create policy "Tutor_bookings: update por involucrado" on public.tutor_bookings
  for update using (auth.uid() in (tutor_id, student_id))
  with check (auth.uid() in (tutor_id, student_id));

-- tutor_messages
alter table public.tutor_messages enable row level security;

drop policy if exists "Tutor_messages: lectura por participante" on public.tutor_messages;
create policy "Tutor_messages: lectura por participante" on public.tutor_messages
  for select using (
    exists (
      select 1 from public.tutor_bookings b
      where b.id = booking_id
        and auth.uid() in (b.tutor_id, b.student_id)
    )
  );

drop policy if exists "Tutor_messages: insert por participante" on public.tutor_messages;
create policy "Tutor_messages: insert por participante" on public.tutor_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.tutor_bookings b
      where b.id = booking_id
        and auth.uid() in (b.tutor_id, b.student_id)
    )
  );

drop policy if exists "Tutor_messages: update read_at por participante" on public.tutor_messages;
create policy "Tutor_messages: update read_at por participante" on public.tutor_messages
  for update using (
    exists (
      select 1 from public.tutor_bookings b
      where b.id = booking_id
        and auth.uid() in (b.tutor_id, b.student_id)
    )
  );

-- tutor_reviews
alter table public.tutor_reviews enable row level security;

drop policy if exists "Tutor_reviews: lectura pública" on public.tutor_reviews;
create policy "Tutor_reviews: lectura pública" on public.tutor_reviews
  for select using (true);

drop policy if exists "Tutor_reviews: insert por reviewer con booking completado" on public.tutor_reviews;
create policy "Tutor_reviews: insert por reviewer con booking completado" on public.tutor_reviews
  for insert with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.tutor_bookings b
      where b.id = booking_id
        and b.student_id = auth.uid()
        and b.status = 'completed'
    )
  );

drop policy if exists "Tutor_reviews: update por reviewer" on public.tutor_reviews;
create policy "Tutor_reviews: update por reviewer" on public.tutor_reviews
  for update using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());

-- recorded_courses
alter table public.recorded_courses enable row level security;

drop policy if exists "Recorded_courses: lectura condicionada" on public.recorded_courses;
create policy "Recorded_courses: lectura condicionada" on public.recorded_courses
  for select using (
    (is_published = true and deleted_at is null)
    or author_id = auth.uid()
    or exists (
      select 1 from public.course_enrollments e
      where e.course_id = id
        and e.student_id = auth.uid()
        and e.status = 'completed'
    )
  );

drop policy if exists "Recorded_courses: insert por author" on public.recorded_courses;
create policy "Recorded_courses: insert por author" on public.recorded_courses
  for insert with check (auth.uid() = author_id);

drop policy if exists "Recorded_courses: update por author" on public.recorded_courses;
create policy "Recorded_courses: update por author" on public.recorded_courses
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists "Recorded_courses: delete por author" on public.recorded_courses;
create policy "Recorded_courses: delete por author" on public.recorded_courses
  for delete using (auth.uid() = author_id);

-- course_modules
alter table public.course_modules enable row level security;

drop policy if exists "Course_modules: lectura si curso visible" on public.course_modules;
create policy "Course_modules: lectura si curso visible" on public.course_modules
  for select using (
    exists (
      select 1 from public.recorded_courses c
      where c.id = course_id
        and (
          (c.is_published = true and c.deleted_at is null)
          or c.author_id = auth.uid()
          or exists (
            select 1 from public.course_enrollments e
            where e.course_id = c.id
              and e.student_id = auth.uid()
              and e.status = 'completed'
          )
        )
    )
  );

drop policy if exists "Course_modules: insert por author" on public.course_modules;
create policy "Course_modules: insert por author" on public.course_modules
  for insert with check (
    exists (
      select 1 from public.recorded_courses c
      where c.id = course_id and c.author_id = auth.uid()
    )
  );

drop policy if exists "Course_modules: update por author" on public.course_modules;
create policy "Course_modules: update por author" on public.course_modules
  for update using (
    exists (
      select 1 from public.recorded_courses c
      where c.id = course_id and c.author_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.recorded_courses c
      where c.id = course_id and c.author_id = auth.uid()
    )
  );

drop policy if exists "Course_modules: delete por author" on public.course_modules;
create policy "Course_modules: delete por author" on public.course_modules
  for delete using (
    exists (
      select 1 from public.recorded_courses c
      where c.id = course_id and c.author_id = auth.uid()
    )
  );

-- course_enrollments
alter table public.course_enrollments enable row level security;

drop policy if exists "Course_enrollments: lectura por involucrado" on public.course_enrollments;
create policy "Course_enrollments: lectura por involucrado" on public.course_enrollments
  for select using (
    auth.uid() = student_id
    or exists (
      select 1 from public.recorded_courses c
      where c.id = course_id and c.author_id = auth.uid()
    )
  );

drop policy if exists "Course_enrollments: insert por student" on public.course_enrollments;
create policy "Course_enrollments: insert por student" on public.course_enrollments
  for insert with check (auth.uid() = student_id);

drop policy if exists "Course_enrollments: update por involucrado" on public.course_enrollments;
create policy "Course_enrollments: update por involucrado" on public.course_enrollments
  for update using (
    auth.uid() = student_id
    or exists (
      select 1 from public.recorded_courses c
      where c.id = course_id and c.author_id = auth.uid()
    )
  );

-- course_progress
alter table public.course_progress enable row level security;

drop policy if exists "Course_progress: lectura por dueño del enrollment" on public.course_progress;
create policy "Course_progress: lectura por dueño del enrollment" on public.course_progress
  for select using (
    exists (
      select 1 from public.course_enrollments e
      where e.id = enrollment_id and e.student_id = auth.uid()
    )
  );

drop policy if exists "Course_progress: insert por dueño del enrollment" on public.course_progress;
create policy "Course_progress: insert por dueño del enrollment" on public.course_progress
  for insert with check (
    exists (
      select 1 from public.course_enrollments e
      where e.id = enrollment_id and e.student_id = auth.uid()
    )
  );

drop policy if exists "Course_progress: update por dueño del enrollment" on public.course_progress;
create policy "Course_progress: update por dueño del enrollment" on public.course_progress
  for update using (
    exists (
      select 1 from public.course_enrollments e
      where e.id = enrollment_id and e.student_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.course_enrollments e
      where e.id = enrollment_id and e.student_id = auth.uid()
    )
  );

-- course_reviews
alter table public.course_reviews enable row level security;

drop policy if exists "Course_reviews: lectura pública" on public.course_reviews;
create policy "Course_reviews: lectura pública" on public.course_reviews
  for select using (true);

drop policy if exists "Course_reviews: insert por reviewer con enrollment completed" on public.course_reviews;
create policy "Course_reviews: insert por reviewer con enrollment completed" on public.course_reviews
  for insert with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.course_enrollments e
      where e.id = enrollment_id
        and e.student_id = auth.uid()
        and e.status = 'completed'
    )
  );

drop policy if exists "Course_reviews: update por reviewer" on public.course_reviews;
create policy "Course_reviews: update por reviewer" on public.course_reviews
  for update using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());

-- ============================================
-- 16. Triggers
-- ============================================

-- 16.a) updated_at en cada tabla con esa columna
drop trigger if exists set_updated_at_tutor_bookings on public.tutor_bookings;
create trigger set_updated_at_tutor_bookings
  before update on public.tutor_bookings
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_tutor_reviews on public.tutor_reviews;
create trigger set_updated_at_tutor_reviews
  before update on public.tutor_reviews
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_recorded_courses on public.recorded_courses;
create trigger set_updated_at_recorded_courses
  before update on public.recorded_courses
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_course_modules on public.course_modules;
create trigger set_updated_at_course_modules
  before update on public.course_modules
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_course_progress on public.course_progress;
create trigger set_updated_at_course_progress
  before update on public.course_progress
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_course_reviews on public.course_reviews;
create trigger set_updated_at_course_reviews
  before update on public.course_reviews
  for each row execute function public.set_updated_at();

-- 16.b) Recalcular total_duration_seconds del curso al cambiar módulos
create or replace function public.refresh_course_total_duration()
returns trigger
language plpgsql
as $$
declare
  v_course_id uuid;
begin
  v_course_id := coalesce(new.course_id, old.course_id);

  update public.recorded_courses
  set total_duration_seconds = coalesce((
    select sum(duration_seconds)::int
    from public.course_modules
    where course_id = v_course_id
  ), 0)
  where id = v_course_id;

  -- Si fue UPDATE de course_id (raro), también refrescar el viejo
  if (tg_op = 'UPDATE' and old.course_id is distinct from new.course_id) then
    update public.recorded_courses
    set total_duration_seconds = coalesce((
      select sum(duration_seconds)::int
      from public.course_modules
      where course_id = old.course_id
    ), 0)
    where id = old.course_id;
  end if;

  return null;
end;
$$;

drop trigger if exists refresh_course_total_duration_aiud on public.course_modules;
create trigger refresh_course_total_duration_aiud
  after insert or update or delete on public.course_modules
  for each row execute function public.refresh_course_total_duration();

-- 16.c) Recalcular rating del tutor en profiles
create or replace function public.refresh_tutor_rating()
returns trigger
language plpgsql
as $$
declare
  v_tutor_id uuid;
begin
  v_tutor_id := coalesce(new.tutor_id, old.tutor_id);

  update public.profiles
  set
    tutor_rating_avg = coalesce((
      select avg(rating)::numeric
      from public.tutor_reviews
      where tutor_id = v_tutor_id
    ), 0),
    tutor_rating_count = (
      select count(*)::int
      from public.tutor_reviews
      where tutor_id = v_tutor_id
    )
  where id = v_tutor_id;

  if (tg_op = 'UPDATE' and old.tutor_id is distinct from new.tutor_id) then
    update public.profiles
    set
      tutor_rating_avg = coalesce((
        select avg(rating)::numeric
        from public.tutor_reviews
        where tutor_id = old.tutor_id
      ), 0),
      tutor_rating_count = (
        select count(*)::int
        from public.tutor_reviews
        where tutor_id = old.tutor_id
      )
    where id = old.tutor_id;
  end if;

  return null;
end;
$$;

drop trigger if exists refresh_tutor_rating_aiud on public.tutor_reviews;
create trigger refresh_tutor_rating_aiud
  after insert or update or delete on public.tutor_reviews
  for each row execute function public.refresh_tutor_rating();

-- 16.d) Recalcular rating del curso
create or replace function public.refresh_course_rating()
returns trigger
language plpgsql
as $$
declare
  v_course_id uuid;
begin
  v_course_id := coalesce(new.course_id, old.course_id);

  update public.recorded_courses
  set
    rating_avg = coalesce((
      select avg(rating)::numeric
      from public.course_reviews
      where course_id = v_course_id
    ), 0),
    rating_count = (
      select count(*)::int
      from public.course_reviews
      where course_id = v_course_id
    )
  where id = v_course_id;

  if (tg_op = 'UPDATE' and old.course_id is distinct from new.course_id) then
    update public.recorded_courses
    set
      rating_avg = coalesce((
        select avg(rating)::numeric
        from public.course_reviews
        where course_id = old.course_id
      ), 0),
      rating_count = (
        select count(*)::int
        from public.course_reviews
        where course_id = old.course_id
      )
    where id = old.course_id;
  end if;

  return null;
end;
$$;

drop trigger if exists refresh_course_rating_aiud on public.course_reviews;
create trigger refresh_course_rating_aiud
  after insert or update or delete on public.course_reviews
  for each row execute function public.refresh_course_rating();

commit;
