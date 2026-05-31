-- Migração: fidelidade — uma visita por cliente por sessão (mesas compartilhadas)
-- Rodar no SQL Editor do Supabase

alter table customer_visits
  drop constraint if exists customer_visits_session_id_key;

drop index if exists customer_visits_session_id_key;

create unique index if not exists customer_visits_customer_session_unique
  on customer_visits(customer_id, session_id);
