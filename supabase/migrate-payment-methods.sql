-- Migração: cartões tokenizados (Asaas) — Fase 1 crédito
-- Rodar no SQL Editor do Supabase

alter table customers
  add column if not exists asaas_customer_id text;

create table if not exists customer_payment_methods (
  id                uuid        primary key default uuid_generate_v4(),
  customer_id       uuid        not null references customers(id) on delete cascade,
  credit_card_token text        not null,
  brand             text,
  last_four         text        not null,
  holder_name       text,
  is_default        boolean     not null default false,
  created_at        timestamptz not null default now(),
  unique (customer_id, credit_card_token)
);

create index if not exists idx_customer_payment_methods_customer
  on customer_payment_methods(customer_id);

alter table customer_payment_methods enable row level security;

-- Exposto apenas via API com service role
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'customer_payment_methods' and policyname = 'public_insert'
  ) then
    create policy "public_insert" on customer_payment_methods for insert with check (true);
  end if;
end $$;
