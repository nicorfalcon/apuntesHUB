-- Rollback de 0013_course_enrollments_rpcs.sql
drop function if exists public.fail_course_enrollment(uuid, text);
drop function if exists public.complete_course_enrollment(uuid, text);
drop function if exists public.enroll_course(uuid);
