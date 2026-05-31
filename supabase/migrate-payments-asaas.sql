-- ============================================================
-- Migração: payments → Asaas (rodar no SQL Editor do Supabase)
-- Corrige: "Could not find the 'asaas_payment_id' column..."
-- ============================================================

-- Colunas novas na tabela payments
alter table payments
  add column if not exists customer_id      uuid references customers(id) on delete set null,
  add column if not exists asaas_payment_id text,
  add column if not exists split_type       text not null default 'combined';

-- Constraint do split_type (ignora se já existir)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_split_type_check'
  ) then
    alter table payments
      add constraint payments_split_type_check
      check (split_type in ('food', 'alcohol', 'combined'));
  end if;
end $$;

-- Status 'processing' (cartão de crédito assíncrono)
do $$
begin
  alter table payments drop constraint if exists payments_status_check;
  alter table payments
    add constraint payments_status_check
    check (status in ('pending', 'processing', 'paid', 'failed', 'refunded'));
exception when others then
  null;
end $$;

-- Remove coluna Stripe legada (se existir)
alter table payments drop column if exists stripe_payment_intent_id;

-- Índice para consultas por sessão
create index if not exists idx_payments_session_status on payments(session_id, status);

-- Taxa de serviço opcional por pagamento (10% incluída ou recusada pelo cliente)
alter table payments
  add column if not exists service_fee_included boolean not null default true;

-- Recarrega cache do PostgREST (Supabase API)
notify pgrst, 'reload schema';
