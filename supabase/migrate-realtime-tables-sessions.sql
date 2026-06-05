-- Adiciona tables e sessions à publication do Supabase Realtime.
-- Sem isso, o garçom não recebe atualizações em tempo real de status de mesa.
alter publication supabase_realtime add table tables;
alter publication supabase_realtime add table sessions;
