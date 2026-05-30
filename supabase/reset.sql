-- ============================================================
-- Qomanda — Reset completo do banco
-- ⚠️  ATENÇÃO: APAGA TODOS OS DADOS E TABELAS ⚠️
--
-- Use apenas para resetar um banco de desenvolvimento.
-- NUNCA execute em produção.
--
-- Após executar, rode schema.sql para recriar tudo.
-- ============================================================

-- Remove triggers
drop trigger if exists trg_session_table_status on sessions;
drop trigger if exists trg_session_table        on sessions;
drop trigger if exists trg_orders_updated_at    on orders;

-- Remove functions
drop function if exists fn_session_table_status();
drop function if exists fn_session_open_table();
drop function if exists fn_orders_updated_at();

-- Remove tabelas (ordem inversa de dependência)
drop table if exists close_request_participants cascade;
drop table if exists close_requests             cascade;
drop table if exists customer_visits            cascade;
drop table if exists loyalty_rules              cascade;
drop table if exists session_participants       cascade;
drop table if exists order_items                cascade;
drop table if exists orders                     cascade;
drop table if exists payments                   cascade;
drop table if exists menu_items                 cascade;
drop table if exists menu_categories            cascade;
drop table if exists sessions                   cascade;
drop table if exists customers                  cascade;
drop table if exists tables                     cascade;
drop table if exists restaurants                cascade;

-- Confirma
select 'Reset concluído. Execute schema.sql para recriar.' as status;
