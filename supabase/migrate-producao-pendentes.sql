-- ==============================================================
-- MIGRATIONS PENDENTES EM PRODUÇÃO
-- Rodar no Supabase SQL Editor (produção) de uma vez.
-- Cobre: async_jobs, webhook_events, nfe_invoices, billing_invoices
--        (colunas extras), financial_retention, service_nfe_invoices
-- ==============================================================

-- ============================================================
-- 1. Fila de jobs assíncronos
-- ============================================================
create table if not exists async_jobs (
  id            uuid primary key default uuid_generate_v4(),
  type          text not null,
  payload       jsonb not null default '{}',
  status        text not null default 'pending'
                check (status in ('pending', 'processing', 'done', 'error')),
  attempts      int not null default 0,
  max_attempts  int not null default 5,
  run_after     timestamptz not null default now(),
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists async_jobs_due_idx
  on async_jobs (run_after)
  where status = 'pending';

create or replace function fn_async_jobs_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end; $$;

drop trigger if exists trg_async_jobs_updated_at on async_jobs;
create trigger trg_async_jobs_updated_at
before update on async_jobs
for each row execute function fn_async_jobs_updated_at();

alter table async_jobs enable row level security;

-- ============================================================
-- 2. Idempotência de webhooks
-- ============================================================
create table if not exists webhook_events (
  id            uuid primary key default uuid_generate_v4(),
  provider      text not null check (provider in ('asaas', 'mercado_pago', 'stripe')),
  event_id      text not null,
  event_type    text,
  status        text not null default 'processing'
                check (status in ('processing', 'processed', 'error', 'ignored')),
  attempts      int not null default 1,
  error_message text,
  payload       jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (provider, event_id)
);

create index if not exists webhook_events_provider_created_idx
  on webhook_events (provider, created_at desc);

create or replace function fn_webhook_events_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end; $$;

drop trigger if exists trg_webhook_events_updated_at on webhook_events;
create trigger trg_webhook_events_updated_at
before update on webhook_events
for each row execute function fn_webhook_events_updated_at();

alter table webhook_events enable row level security;

-- ============================================================
-- 3. NF-e (nota do restaurante → consumidor)
-- ============================================================
alter table restaurants
  add column if not exists nfe_note_type text
    check (nfe_note_type is null or nfe_note_type in ('nfce', 'nfse'));

create table if not exists nfe_invoices (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references restaurants(id) on delete cascade,
  payment_id      uuid references payments(id) on delete set null,
  customer_id     uuid references customers(id) on delete set null,
  session_id      uuid references sessions(id) on delete set null,
  note_type       text not null check (note_type in ('nfce', 'nfse')),
  status          text not null default 'pending'
                  check (status in ('pending', 'processing', 'issued', 'error', 'simulated', 'cancelled')),
  provider        text,
  provider_ref    text,
  environment     text not null default 'homologacao'
                  check (environment in ('homologacao', 'producao')),
  number          text,
  series          text,
  amount          numeric(10,2) not null default 0,
  danfe_url       text,
  xml_url         text,
  access_key      text,
  error_message   text,
  whatsapp_sent_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists nfe_invoices_restaurant_idx on nfe_invoices (restaurant_id, created_at desc);
create index if not exists nfe_invoices_payment_idx on nfe_invoices (payment_id);

create or replace function fn_nfe_invoices_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end; $$;

drop trigger if exists trg_nfe_invoices_updated_at on nfe_invoices;
create trigger trg_nfe_invoices_updated_at
before update on nfe_invoices
for each row execute function fn_nfe_invoices_updated_at();

alter table nfe_invoices enable row level security;

drop policy if exists "owner_all" on nfe_invoices;
create policy "owner_all" on nfe_invoices for all using (
  restaurant_id in (select id from restaurants where owner_id = auth.uid())
);

-- ============================================================
-- 4. Billing: colunas extras em billing_invoices
-- ============================================================
alter table restaurants
  add column if not exists asaas_billing_customer_id text;

alter table billing_invoices
  add column if not exists asaas_payment_id text,
  add column if not exists charge_method text
    check (charge_method is null or charge_method in ('pix', 'boleto', 'credit_card')),
  add column if not exists invoice_url text,
  add column if not exists period_year int,
  add column if not exists period_month int,
  add column if not exists last_reminder_at timestamptz;

create unique index if not exists billing_invoices_period_unique
  on billing_invoices (restaurant_id, period_start);

create index if not exists billing_invoices_asaas_payment_idx
  on billing_invoices (asaas_payment_id);

-- ============================================================
-- 5. Retenção financeira + agregados mensais
-- ============================================================
create table if not exists restaurant_monthly_stats (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references restaurants(id) on delete cascade,
  period_year     int not null,
  period_month    int not null check (period_month between 1 and 12),
  revenue_total   numeric(12,2) not null default 0,
  payment_count   int not null default 0,
  order_count     int not null default 0,
  gmv_digital     numeric(12,2) not null default 0,
  commission_total numeric(12,2) not null default 0,
  rolled_up_at    timestamptz not null default now(),
  unique (restaurant_id, period_year, period_month)
);

create index if not exists restaurant_monthly_stats_restaurant_idx
  on restaurant_monthly_stats (restaurant_id, period_year desc, period_month desc);

create table if not exists customer_restaurant_totals (
  customer_id       uuid not null references customers(id) on delete cascade,
  restaurant_id     uuid not null references restaurants(id) on delete cascade,
  total_spent       numeric(12,2) not null default 0,
  payment_count     int not null default 0,
  last_payment_at   timestamptz,
  updated_at        timestamptz not null default now(),
  primary key (customer_id, restaurant_id)
);

create index if not exists customer_restaurant_totals_restaurant_idx
  on customer_restaurant_totals (restaurant_id);

create table if not exists financial_retention_runs (
  id                    uuid primary key default uuid_generate_v4(),
  retention_days        int not null,
  cutoff_at             timestamptz not null,
  audit_events_deleted  int not null default 0,
  snapshots_deleted     int not null default 0,
  nfe_deleted           int not null default 0,
  payments_deleted      int not null default 0,
  orders_deleted        int not null default 0,
  order_items_deleted   int not null default 0,
  months_rolled_up      int not null default 0,
  triggered_by          text not null default 'cron'
                        check (triggered_by in ('cron', 'staff', 'system')),
  created_at            timestamptz not null default now()
);

create or replace function fn_rollup_restaurant_month(
  p_restaurant_id uuid,
  p_year int,
  p_month int
)
returns void language plpgsql security definer as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_revenue numeric(12,2);
  v_payments int;
  v_gmv numeric(12,2);
  v_commission numeric(12,2);
  v_orders int;
begin
  v_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'America/Sao_Paulo');
  v_end := v_start + interval '1 month';

  select
    coalesce(sum(case when status = 'paid' and method <> 'offer' then amount else 0 end), 0),
    count(*) filter (where status = 'paid' and method <> 'offer'),
    coalesce(sum(case when status = 'paid' and method not in ('cash', 'offer') then amount else 0 end), 0),
    coalesce(sum(case when status = 'paid' then coalesce(commission_amount, 0) else 0 end), 0)
  into v_revenue, v_payments, v_gmv, v_commission
  from payments
  where restaurant_id = p_restaurant_id
    and coalesce(paid_at, created_at) >= v_start
    and coalesce(paid_at, created_at) < v_end;

  select count(*)
  into v_orders
  from orders
  where restaurant_id = p_restaurant_id
    and status <> 'cancelled'
    and created_at >= v_start
    and created_at < v_end;

  insert into restaurant_monthly_stats (
    restaurant_id, period_year, period_month,
    revenue_total, payment_count, order_count,
    gmv_digital, commission_total, rolled_up_at
  ) values (
    p_restaurant_id, p_year, p_month,
    v_revenue, v_payments, v_orders,
    v_gmv, v_commission, now()
  )
  on conflict (restaurant_id, period_year, period_month) do update set
    revenue_total = excluded.revenue_total,
    payment_count = excluded.payment_count,
    order_count = excluded.order_count,
    gmv_digital = excluded.gmv_digital,
    commission_total = excluded.commission_total,
    rolled_up_at = now();
end;
$$;

create or replace function fn_upsert_customer_restaurant_total()
returns trigger language plpgsql security definer as $$
begin
  if NEW.status = 'paid'
    and (TG_OP = 'INSERT' or OLD.status is distinct from NEW.status)
    and NEW.customer_id is not null
  then
    insert into customer_restaurant_totals (
      customer_id, restaurant_id, total_spent, payment_count, last_payment_at, updated_at
    ) values (
      NEW.customer_id, NEW.restaurant_id, NEW.amount, 1,
      coalesce(NEW.paid_at, now()), now()
    )
    on conflict (customer_id, restaurant_id) do update set
      total_spent = customer_restaurant_totals.total_spent + excluded.total_spent,
      payment_count = customer_restaurant_totals.payment_count + 1,
      last_payment_at = greatest(
        coalesce(customer_restaurant_totals.last_payment_at, excluded.last_payment_at),
        coalesce(excluded.last_payment_at, now())
      ),
      updated_at = now();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_customer_restaurant_totals on payments;
create trigger trg_customer_restaurant_totals
after insert or update on payments
for each row execute function fn_upsert_customer_restaurant_total();

alter table restaurant_monthly_stats enable row level security;
alter table customer_restaurant_totals enable row level security;
alter table financial_retention_runs enable row level security;

-- Backfill totais do cliente a partir do histórico
insert into customer_restaurant_totals (customer_id, restaurant_id, total_spent, payment_count, last_payment_at)
select
  p.customer_id,
  p.restaurant_id,
  sum(p.amount),
  count(*),
  max(coalesce(p.paid_at, p.created_at))
from payments p
where p.status = 'paid'
  and p.customer_id is not null
group by p.customer_id, p.restaurant_id
on conflict (customer_id, restaurant_id) do update set
  total_spent = excluded.total_spent,
  payment_count = excluded.payment_count,
  last_payment_at = excluded.last_payment_at,
  updated_at = now();

-- ============================================================
-- 6. NF-e de serviço (Qomanda → restaurante)
-- ============================================================
create table if not exists service_nfe_invoices (
  id                 uuid primary key default uuid_generate_v4(),
  billing_invoice_id uuid not null references billing_invoices(id) on delete cascade,
  restaurant_id      uuid not null references restaurants(id) on delete cascade,
  status             text not null default 'pending'
                     check (status in ('pending', 'processing', 'issued', 'error', 'simulated', 'cancelled')),
  provider           text,
  provider_ref       text,
  environment        text not null default 'homologacao'
                     check (environment in ('homologacao', 'producao')),
  number             text,
  amount             numeric(10,2) not null default 0,
  danfe_url          text,
  xml_url            text,
  access_key         text,
  error_message      text,
  emailed_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (billing_invoice_id)
);

create index if not exists service_nfe_invoices_restaurant_idx
  on service_nfe_invoices (restaurant_id, created_at desc);

create or replace function fn_service_nfe_invoices_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end; $$;

drop trigger if exists trg_service_nfe_invoices_updated_at on service_nfe_invoices;
create trigger trg_service_nfe_invoices_updated_at
before update on service_nfe_invoices
for each row execute function fn_service_nfe_invoices_updated_at();

alter table service_nfe_invoices enable row level security;

notify pgrst, 'reload schema';
