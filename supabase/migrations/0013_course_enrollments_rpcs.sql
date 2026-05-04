-- ============================================
-- MIGRACIÓN: RPCs para inscripción a cursos grabados
-- Replica el flujo de purchases para Mercado Pago Checkout Pro.
-- ============================================

-- 1. RPC: Crear/reutilizar inscripción pendiente
create or replace function public.enroll_course(p_course_id uuid)
returns json language plpgsql security definer set search_path = ''
as $$
declare
  v_course record;
  v_enrollment_id uuid;
  v_existing record;
  v_fee numeric(10,2);
  v_seller_amount numeric(10,2);
  v_has_mp boolean;
begin
  select * into v_course
  from public.recorded_courses
  where id = p_course_id and is_published = true and deleted_at is null;
  if not found then raise exception 'Curso no encontrado o no publicado'; end if;

  if v_course.author_id = auth.uid() then
    raise exception 'No podés inscribirte a tu propio curso';
  end if;

  if exists (
    select 1 from public.course_enrollments
    where course_id = p_course_id and student_id = auth.uid() and status = 'completed'
  ) then
    raise exception 'Ya estás inscripto a este curso';
  end if;

  select exists(
    select 1 from public.seller_mp_credentials where id = v_course.author_id
  ) into v_has_mp;
  if not v_has_mp then
    raise exception 'El autor del curso no tiene Mercado Pago configurado';
  end if;

  select * into v_existing
  from public.course_enrollments
  where course_id = p_course_id and student_id = auth.uid() and status = 'pending';

  if found then
    if v_existing.purchased_at > now() - interval '5 minutes' then
      return json_build_object(
        'enrollment_id', v_existing.id,
        'status', 'pending',
        'reused', true
      );
    else
      delete from public.course_enrollments where id = v_existing.id;
    end if;
  end if;

  -- La migración 0014 ajusta esta comisión a 10%.
  v_fee := round(v_course.price_ars * 0.20, 2);
  v_seller_amount := v_course.price_ars - v_fee;

  insert into public.course_enrollments (
    course_id, student_id, amount, platform_fee, seller_amount, status
  )
  values (
    p_course_id, auth.uid(), v_course.price_ars, v_fee, v_seller_amount, 'pending'
  )
  returning id into v_enrollment_id;

  return json_build_object(
    'enrollment_id', v_enrollment_id,
    'status', 'pending',
    'reused', false
  );
end;
$$;

-- 2. RPC: Completar inscripción (llamada desde webhook via service_role)
create or replace function public.complete_course_enrollment(
  p_enrollment_id uuid,
  p_payment_id text
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.course_enrollments
  set status = 'completed', payment_id = p_payment_id
  where id = p_enrollment_id and status = 'pending';
end;
$$;

-- 3. RPC: Marcar inscripción como fallida
create or replace function public.fail_course_enrollment(
  p_enrollment_id uuid,
  p_payment_id text
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.course_enrollments
  set status = 'failed', payment_id = p_payment_id
  where id = p_enrollment_id and status = 'pending';
end;
$$;
