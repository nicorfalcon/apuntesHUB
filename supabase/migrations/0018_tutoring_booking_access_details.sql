-- ============================================
-- Migración: datos de acceso para clases particulares
-- Fecha: 2026-05-11
--
-- La UI de clases permite que el profesor cargue un link de reunión
-- o una ubicación después de que el pago confirma la reserva.
-- Estas columnas ya están reflejadas en los tipos generados, pero faltaban
-- en producción y rompían las consultas de /clases y /profile/profesor.
-- ============================================

begin;

alter table public.tutor_bookings
  add column if not exists meeting_url text,
  add column if not exists location_details text;

comment on column public.tutor_bookings.meeting_url is
  'Link de reunión online que carga el tutor para una clase confirmada.';

comment on column public.tutor_bookings.location_details is
  'Ubicación o instrucciones presenciales que carga el tutor para una clase confirmada.';

commit;
