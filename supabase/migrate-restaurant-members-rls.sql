-- Garçom/equipe: leitura da própria linha em restaurant_members (client Supabase)
-- Sem isso, resolveWaiterRestaurantId falha para membros convidados (RLS bloqueia).

drop policy if exists "member_self_read" on restaurant_members;
create policy "member_self_read" on restaurant_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "owner_members_all" on restaurant_members;
create policy "owner_members_all" on restaurant_members
  for all
  to authenticated
  using (
    exists (
      select 1 from restaurants r
      where r.id = restaurant_members.restaurant_id
        and r.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from restaurants r
      where r.id = restaurant_members.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
