-- ============================================
-- MIGRACIÓN: cortar recursión RLS entre cursos e inscripciones
-- recorded_courses consultaba course_enrollments y course_enrollments
-- consultaba recorded_courses. Eso rompía el catálogo público de cursos.
-- ============================================

create or replace function public.is_recorded_course_author(
  p_course_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_user_id is not null
    and exists (
      select 1
      from public.recorded_courses c
      where c.id = p_course_id
        and c.author_id = p_user_id
    ),
    false
  );
$$;

create or replace function public.has_completed_course_enrollment(
  p_course_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_user_id is not null
    and exists (
      select 1
      from public.course_enrollments e
      where e.course_id = p_course_id
        and e.student_id = p_user_id
        and e.status = 'completed'
    ),
    false
  );
$$;

create or replace function public.can_view_recorded_course(
  p_course_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from public.recorded_courses c
      where c.id = p_course_id
        and (
          (c.is_published = true and c.deleted_at is null)
          or c.author_id = p_user_id
          or exists (
            select 1
            from public.course_enrollments e
            where e.course_id = c.id
              and e.student_id = p_user_id
              and e.status = 'completed'
          )
        )
    ),
    false
  );
$$;

grant execute on function public.is_recorded_course_author(uuid, uuid) to anon, authenticated;
grant execute on function public.has_completed_course_enrollment(uuid, uuid) to anon, authenticated;
grant execute on function public.can_view_recorded_course(uuid, uuid) to anon, authenticated;

drop policy if exists "Recorded_courses: lectura condicionada" on public.recorded_courses;
create policy "Recorded_courses: lectura condicionada" on public.recorded_courses
  for select using (
    public.can_view_recorded_course(id, auth.uid())
  );

drop policy if exists "Course_modules: lectura si curso visible" on public.course_modules;
create policy "Course_modules: lectura si curso visible" on public.course_modules
  for select using (
    public.can_view_recorded_course(course_id, auth.uid())
  );

drop policy if exists "Course_modules: insert por author" on public.course_modules;
create policy "Course_modules: insert por author" on public.course_modules
  for insert with check (
    public.is_recorded_course_author(course_id, auth.uid())
  );

drop policy if exists "Course_modules: update por author" on public.course_modules;
create policy "Course_modules: update por author" on public.course_modules
  for update using (
    public.is_recorded_course_author(course_id, auth.uid())
  ) with check (
    public.is_recorded_course_author(course_id, auth.uid())
  );

drop policy if exists "Course_modules: delete por author" on public.course_modules;
create policy "Course_modules: delete por author" on public.course_modules
  for delete using (
    public.is_recorded_course_author(course_id, auth.uid())
  );

drop policy if exists "Course_enrollments: lectura por involucrado" on public.course_enrollments;
create policy "Course_enrollments: lectura por involucrado" on public.course_enrollments
  for select using (
    auth.uid() = student_id
    or public.is_recorded_course_author(course_id, auth.uid())
  );

drop policy if exists "Course_enrollments: update por involucrado" on public.course_enrollments;
create policy "Course_enrollments: update por involucrado" on public.course_enrollments
  for update using (
    auth.uid() = student_id
    or public.is_recorded_course_author(course_id, auth.uid())
  ) with check (
    auth.uid() = student_id
    or public.is_recorded_course_author(course_id, auth.uid())
  );
