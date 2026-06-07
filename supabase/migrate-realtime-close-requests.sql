-- ============================================================
-- Realtime para close_requests + close_request_participants
-- Sem isto, o fluxo de DIVISÃO DA CONTA com aceite (item 5) não atualiza ao
-- vivo: o iniciador não vê os aceites chegando e os convidados não veem a
-- divisão liberar para pagamento sem recarregar a tela.
-- (O checkout assina postgres_changes nessas duas tabelas.)
-- ============================================================

-- close_requests (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'close_requests'
  ) then
    alter publication supabase_realtime add table close_requests;
  end if;
end $$;

-- close_request_participants (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'close_request_participants'
  ) then
    alter publication supabase_realtime add table close_request_participants;
  end if;
end $$;

-- REPLICA IDENTITY FULL: aceite/recusa/pagamento chegam via UPDATE — sem isto
-- o payload de UPDATE/DELETE não traz a linha completa para o cliente.
alter table close_requests             replica identity full;
alter table close_request_participants replica identity full;

notify pgrst, 'reload schema';
