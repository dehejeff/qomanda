-- ============================================================
-- Backfill de customer_visits a partir de session_participants
--
-- Contexto: o check-in gravava a visita com onConflict 'session_id' (1 por
-- sessão). Em mesas compartilhadas, o último a entrar sobrescrevia os demais —
-- e, após aplicar migrate-loyalty-visits.sql (unique por customer+session), o
-- upsert passou a falhar silenciosamente, deixando clientes sem visita (somem
-- da página Clientes, pois a RLS de customers depende de customer_visits).
--
-- Este script recria as visitas faltantes para TODOS os participantes de
-- sessões já existentes. Idempotente (on conflict do nothing).
-- Pré-requisito: migrate-loyalty-visits.sql aplicado (unique customer+session).
-- ============================================================

insert into customer_visits (customer_id, restaurant_id, session_id, created_at)
select
  sp.customer_id,
  s.restaurant_id,
  sp.session_id,
  coalesce(s.created_at, now())
from session_participants sp
join sessions s on s.id = sp.session_id
where sp.customer_id is not null
  and not exists (
    select 1 from customer_visits cv
    where cv.customer_id = sp.customer_id
      and cv.session_id = sp.session_id
  )
on conflict (customer_id, session_id) do nothing;
