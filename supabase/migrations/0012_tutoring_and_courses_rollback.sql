-- ============================================
-- ROLLBACK migración tutoría y cursos grabados
-- NO CORRER SALVO EMERGENCIA
-- ============================================

begin;

-- Drop triggers (en orden inverso al de creación)
drop trigger if exists refresh_course_rating_aiud on public.course_reviews;
drop trigger if exists refresh_tutor_rating_aiud on public.tutor_reviews;
drop trigger if exists refresh_course_total_duration_aiud on public.course_modules;

drop trigger if exists set_updated_at_course_reviews on public.course_reviews;
drop trigger if exists set_updated_at_course_progress on public.course_progress;
drop trigger if exists set_updated_at_course_modules on public.course_modules;
drop trigger if exists set_updated_at_recorded_courses on public.recorded_courses;
drop trigger if exists set_updated_at_tutor_reviews on public.tutor_reviews;
drop trigger if exists set_updated_at_tutor_bookings on public.tutor_bookings;

-- Drop functions específicas (set_updated_at se conserva, puede usarla otra tabla)
drop function if exists public.refresh_course_rating();
drop function if exists public.refresh_tutor_rating();
drop function if exists public.refresh_course_total_duration();

-- Drop tablas (orden inverso por FKs)
drop table if exists public.course_reviews cascade;
drop table if exists public.course_progress cascade;
drop table if exists public.course_enrollments cascade;
drop table if exists public.course_modules cascade;
drop table if exists public.recorded_courses cascade;
drop table if exists public.tutor_reviews cascade;
drop table if exists public.tutor_messages cascade;
drop table if exists public.tutor_bookings cascade;
drop table if exists public.tutor_availability cascade;
drop table if exists public.tutor_subjects cascade;
drop table if exists public.subjects cascade;

-- Revertir ALTER de profiles
alter table public.profiles drop column if exists tutor_rating_count;
alter table public.profiles drop column if exists tutor_rating_avg;
alter table public.profiles drop column if exists tutor_verified_at;
alter table public.profiles drop column if exists tutor_bio;
alter table public.profiles drop column if exists is_tutor;

-- NOTA: public.set_updated_at() NO se borra porque puede estar siendo usada por
-- triggers de otras tablas pre-existentes. Borrar a mano si se confirma desuso.

commit;
