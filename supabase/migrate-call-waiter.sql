-- ============================================================
-- Chamar Garçom: notificação do cliente → painel/garçom
-- Reutiliza restaurant_notifications, adicionando o tipo 'call_waiter'.
-- ============================================================

alter table restaurant_notifications
  drop constraint if exists restaurant_notifications_type_check;

alter table restaurant_notifications
  add constraint restaurant_notifications_type_check
  check (type in ('nfe_retention', 'call_waiter'));

-- Sessão de onde partiu o chamado (para throttle e contexto da mesa)
alter table restaurant_notifications
  add column if not exists session_id uuid references sessions(id) on delete set null;

create index if not exists restaurant_notifications_call_waiter_idx
  on restaurant_notifications (restaurant_id, created_at desc)
  where type = 'call_waiter';

-- RLS: dono e equipe (garçom/cozinha/gerente) leem e atualizam as notificações
-- do próprio restaurante (necessário p/ realtime + "atender" no app do garçom).
drop policy if exists "restaurant_team_read_notifications" on restaurant_notifications;
create policy "restaurant_team_read_notifications" on restaurant_notifications
  for select to authenticated
  using (
    restaurant_id in (select id from restaurants where owner_id = auth.uid())
    or restaurant_id in (
      select restaurant_id from restaurant_members
      where active = true and (
        user_id = auth.uid()
        or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    )
  );

drop policy if exists "restaurant_team_update_notifications" on restaurant_notifications;
create policy "restaurant_team_update_notifications" on restaurant_notifications
  for update to authenticated
  using (
    restaurant_id in (select id from restaurants where owner_id = auth.uid())
    or restaurant_id in (
      select restaurant_id from restaurant_members
      where active = true and (
        user_id = auth.uid()
        or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    )
  );

notify pgrst, 'reload schema';
