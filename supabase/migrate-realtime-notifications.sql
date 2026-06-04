-- ============================================================
-- Realtime para restaurant_notifications
-- Sem isto, INSERTs não são entregues por postgres_changes — o sino do
-- dashboard e a banner "Chamar Garçom" do app do garçom nunca recebem
-- eventos em tempo real (só atualizam no load/polling).
-- ============================================================

-- Adiciona a tabela à publicação do Realtime (idempotente).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'restaurant_notifications'
  ) then
    alter publication supabase_realtime add table restaurant_notifications;
  end if;
end $$;

-- REPLICA IDENTITY FULL garante que UPDATE/DELETE também tragam os dados
-- completos da linha (útil se assinarmos esses eventos no futuro).
alter table restaurant_notifications replica identity full;

notify pgrst, 'reload schema';
