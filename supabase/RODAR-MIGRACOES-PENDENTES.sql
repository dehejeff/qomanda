-- ==============================================================
-- MIGRACOES PENDENTES — rodar TUDO de uma vez no Supabase SQL Editor
-- Gerado pelo smoke test. Cobre: conta comercial, modelo, PIX manual.
-- ==============================================================

-- ===== 1/3: migrate-commercial-restaurant-account.sql =====
-- ============================================================
-- Modelo comercial: gateway do restaurante, comissão mensal, balcão, equipe
-- ============================================================

-- Planos atualizados (199 / 299 / 499) + desconto na comissão por plano
alter table plans
  add column if not exists commission_plan_discount numeric(4,2) not null default 0;

update plans set
  name = 'Starter',
  max_tables = 20,
  monthly_fee = 199.00,
  platform_fee_percent = 2.99,
  platform_fee_fixed = 0,
  commission_plan_discount = 0,
  trial_days = 14,
  display_order = 1
where id = 'starter';

update plans set
  name = 'Growth',
  max_tables = 50,
  monthly_fee = 299.00,
  platform_fee_percent = 2.99,
  platform_fee_fixed = 0,
  commission_plan_discount = 0.20,
  trial_days = 14,
  display_order = 2
where id = 'growth';

update plans set
  name = 'Pro',
  max_tables = 100,
  monthly_fee = 499.00,
  platform_fee_percent = 2.99,
  platform_fee_fixed = 0,
  commission_plan_discount = 0.40,
  trial_days = 14,
  display_order = 3
where id = 'pro';

insert into plans (id, name, max_tables, monthly_fee, platform_fee_percent, platform_fee_fixed, commission_plan_discount, trial_days, display_order)
values ('enterprise', 'Enterprise', null, 0, 0, 0, 0.60, 14, 4)
on conflict (id) do update set
  commission_plan_discount = excluded.commission_plan_discount;

-- Restaurante: modo operacional + gateway próprio (100% pro restaurante)
alter table restaurants
  add column if not exists operational_mode text not null default 'both'
    check (operational_mode in ('dine_in', 'counter', 'both')),
  add column if not exists payment_gateway_provider text
    check (payment_gateway_provider is null or payment_gateway_provider in ('manual', 'asaas')),
  add column if not exists payment_gateway_api_key_encrypted text,
  add column if not exists payment_gateway_environment text not null default 'sandbox'
    check (payment_gateway_environment in ('sandbox', 'production')),
  add column if not exists payment_gateway_connected_at timestamptz,
  add column if not exists marketplace_split_enabled boolean not null default false,
  add column if not exists setup_fee_paid numeric(10,2),
  add column if not exists counter_order_seq int not null default 0;

comment on column restaurants.operational_mode is 'dine_in=salão, counter=balcão, both=ambos';
comment on column restaurants.marketplace_split_enabled is 'false=recebimento 100% na conta do restaurante; comissão faturada mensalmente';

-- Sessão: salão vs balcão
alter table sessions
  add column if not exists service_mode text not null default 'dine_in'
    check (service_mode in ('dine_in', 'counter'));

-- Pedidos: número de exibição (balcão) + canal
alter table orders
  add column if not exists display_number int,
  add column if not exists order_channel text not null default 'table'
    check (order_channel in ('table', 'counter'));

create index if not exists orders_restaurant_display_idx
  on orders (restaurant_id, display_number desc nulls last);

-- Comissão registrada por pagamento (base da fatura mensal)
alter table payments
  add column if not exists commission_rate numeric(5,4),
  add column if not exists commission_amount numeric(10,2),
  add column if not exists commission_exempt boolean not null default false;

comment on column payments.commission_exempt is 'true para cash/offer — sem comissão Qomanda';

-- Faturas mensais Qomanda → restaurante (mensalidade + comissão acumulada)
create table if not exists restaurant_monthly_invoices (
  id                uuid primary key default uuid_generate_v4(),
  restaurant_id     uuid not null references restaurants(id) on delete cascade,
  period_year       int not null,
  period_month      int not null check (period_month between 1 and 12),
  monthly_fee       numeric(10,2) not null default 0,
  gmv_digital       numeric(12,2) not null default 0,
  commission_total  numeric(12,2) not null default 0,
  total_due         numeric(12,2) not null default 0,
  status            text not null default 'draft'
                    check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date          date,
  paid_at           timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (restaurant_id, period_year, period_month)
);

create index if not exists restaurant_monthly_invoices_status_idx
  on restaurant_monthly_invoices (status, due_date);

-- Equipe do restaurante (garçom, cozinha, gerente)
create table if not exists restaurant_members (
  id            uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  email         text not null,
  name          text,
  role          text not null default 'waiter'
                check (role in ('owner', 'waiter', 'kitchen', 'manager')),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (restaurant_id, email)
);

create index if not exists restaurant_members_user_idx on restaurant_members (user_id);
create index if not exists restaurant_members_email_idx on restaurant_members (lower(email));

alter table restaurant_monthly_invoices enable row level security;
alter table restaurant_members enable row level security;

notify pgrst, 'reload schema';

-- ===== 2/3: migrate-restaurant-model.sql =====
-- Modelo operacional do restaurante (preset no cadastro)
alter table restaurants
  add column if not exists restaurant_model text
    check (restaurant_model is null or restaurant_model in (
      'salao', 'balcao', 'salao_balcao', 'rodizio', 'buffet_peso', 'food_hall'
    )),
  add column if not exists onboarding_completed_at timestamptz;

comment on column restaurants.restaurant_model is 'Preset operacional escolhido no cadastro (salao, balcao, salao_balcao, …)';
comment on column restaurants.onboarding_completed_at is 'Quando o checklist inicial (gateway + cardápio) foi concluído';

notify pgrst, 'reload schema';

-- ===== 3/3: migrate-restaurant-manual-payment.sql =====
-- Pagamento manual: PIX / conta bancária do restaurante (sem Asaas)
alter table restaurants
  add column if not exists manual_pix_key text,
  add column if not exists manual_pix_key_type text
    check (manual_pix_key_type is null or manual_pix_key_type in ('cpf', 'cnpj', 'email', 'phone', 'random')),
  add column if not exists manual_payment_holder_name text,
  add column if not exists manual_payment_notes text,
  add column if not exists manual_payment_configured_at timestamptz;

comment on column restaurants.manual_pix_key is 'Chave PIX do restaurante (pagamento manual, 100% na conta do restaurante)';
comment on column restaurants.manual_payment_notes is 'Instruções extras exibidas ao cliente no checkout';

notify pgrst, 'reload schema';
