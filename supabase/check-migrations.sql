-- ============================================================
-- Verificação de migrações aplicadas (somente leitura)
-- Rode no Supabase → SQL Editor. Cada linha diz se o artefato existe no banco.
-- "OK" = aplicado · "FALTA" = rodar a migração correspondente.
-- Não altera nada — pode rodar quantas vezes quiser.
-- ============================================================

select categoria, recurso,
       case when ok then 'OK' else 'FALTA' end as status,
       migracao
from (
  -- ── Tabelas essenciais ────────────────────────────────────
  select 1 as seq, 'Tabela' as categoria, 'async_jobs (fila NF-e/WhatsApp)' as recurso,
         to_regclass('public.async_jobs') is not null as ok,
         'migrate-async-jobs.sql' as migracao
  union all
  select 2, 'Tabela', 'webhook_events (idempotência Asaas/MP)',
         to_regclass('public.webhook_events') is not null,
         'migrate-webhook-events.sql'
  union all
  select 3, 'Tabela', 'nfe_invoices (NF-e ao cliente)',
         to_regclass('public.nfe_invoices') is not null,
         'migrate-nfe-invoices.sql'
  union all
  select 4, 'Tabela', 'service_nfe_invoices (NF-e de serviço)',
         to_regclass('public.service_nfe_invoices') is not null,
         'migrate-service-nfe.sql'
  union all
  select 5, 'Tabela', 'close_requests (divisão da conta)',
         to_regclass('public.close_requests') is not null,
         'schema.sql / migrate.sql'
  union all
  select 6, 'Tabela', 'close_request_participants (divisão da conta)',
         to_regclass('public.close_request_participants') is not null,
         'schema.sql / migrate.sql'

  -- ── Colunas ───────────────────────────────────────────────
  union all
  select 10, 'Coluna', 'restaurants.mp_refresh_token_encrypted (MP OAuth)',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='restaurants'
                   and column_name='mp_refresh_token_encrypted'),
         'migrate-mercadopago-oauth.sql'
  union all
  select 11, 'Coluna', 'billing_invoices.last_reminder_at (lembrete atraso)',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='billing_invoices'
                   and column_name='last_reminder_at'),
         'migrate-billing-reminders.sql'
  union all
  select 12, 'Coluna', 'restaurant_notifications.session_id (Chamar Garçom)',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='restaurant_notifications'
                   and column_name='session_id'),
         'migrate-call-waiter.sql'
  union all
  select 13, 'Coluna', 'orders.order_channel / display_number (balcão)',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='orders'
                   and column_name='order_channel'),
         'migrate-commercial-restaurant-account.sql'
  union all
  select 14, 'Coluna', 'sessions.service_mode (balcão x mesa)',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='sessions'
                   and column_name='service_mode'),
         'migrate-commercial-restaurant-account.sql'
  union all
  select 15, 'Coluna', 'restaurants.couvert_enabled (couvert)',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='restaurants'
                   and column_name='couvert_enabled'),
         'migrate-couvert.sql'
  union all
  select 16, 'Coluna', 'menu_items.couvert_kind (couvert/artístico)',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='menu_items'
                   and column_name='couvert_kind'),
         'migrate-couvert.sql'
  union all
  select 17, 'Coluna', 'tables.archived_at (arquivar mesa)',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='tables'
                   and column_name='archived_at'),
         'migrate-tables-archive.sql'

  -- ── Índices de performance ────────────────────────────────
  union all
  select 20, 'Índice', 'idx_payments_restaurant_status_paid_at',
         to_regclass('public.idx_payments_restaurant_status_paid_at') is not null,
         'migrate-performance-indexes.sql'
  union all
  select 21, 'Índice', 'idx_orders_restaurant_created_at',
         to_regclass('public.idx_orders_restaurant_created_at') is not null,
         'migrate-performance-indexes.sql'
  union all
  select 22, 'Índice', 'idx_sessions_restaurant_status',
         to_regclass('public.idx_sessions_restaurant_status') is not null,
         'migrate-performance-indexes.sql'
  union all
  select 23, 'Índice', 'customer_visits_customer_session_unique (1 visita/cliente/sessão)',
         to_regclass('public.customer_visits_customer_session_unique') is not null,
         'migrate-loyalty-visits.sql'

  -- ── Realtime (publicação supabase_realtime) ───────────────
  union all
  select 30, 'Realtime', 'orders',
         exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='orders'),
         'migrate-realtime-orders.sql'
  union all
  select 31, 'Realtime', 'order_items',
         exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='order_items'),
         'migrate-realtime-orders.sql'
  union all
  select 32, 'Realtime', 'sessions',
         exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='sessions'),
         'migrate-realtime-tables-sessions.sql'
  union all
  select 33, 'Realtime', 'tables',
         exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='tables'),
         'migrate-realtime-tables-sessions.sql'
  union all
  select 34, 'Realtime', 'payments',
         exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='payments'),
         'migrate-realtime.sql'
  union all
  select 35, 'Realtime', 'restaurant_notifications (sino/Chamar Garçom)',
         exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='restaurant_notifications'),
         'migrate-realtime-notifications.sql'
  union all
  select 36, 'Realtime', 'close_requests (divisão ao vivo)',
         exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='close_requests'),
         'migrate-realtime-close-requests.sql'
  union all
  select 37, 'Realtime', 'close_request_participants (divisão ao vivo)',
         exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='close_request_participants'),
         'migrate-realtime-close-requests.sql'
) checks
order by seq;
