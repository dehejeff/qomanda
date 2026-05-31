-- ============================================================
-- Portal interno Qomanda — planos, assinaturas, faturas, staff
-- ============================================================

-- Planos comerciais (espelham a landing page)
create table if not exists plans (
  id                    text primary key,
  name                  text not null,
  max_tables            int,
  monthly_fee           numeric(10,2) not null default 0,
  platform_fee_percent  numeric(5,2)  not null default 0,
  platform_fee_fixed    numeric(10,2) not null default 0,
  trial_days            int           not null default 14,
  active                boolean       not null default true,
  display_order         int           not null default 0,
  created_at            timestamptz   not null default now()
);

insert into plans (id, name, max_tables, monthly_fee, platform_fee_percent, platform_fee_fixed, trial_days, display_order)
values
  ('starter',    'Starter',    20,  199.00, 1.99, 0, 14, 1),
  ('growth',     'Growth',     50,  299.00, 1.79, 0, 14, 2),
  ('pro',        'Pro',       100,  449.00, 1.49, 0, 14, 3),
  ('enterprise', 'Enterprise', null, 0.00, 0.00, 0, 14, 4)
on conflict (id) do update set
  name = excluded.name,
  max_tables = excluded.max_tables,
  monthly_fee = excluded.monthly_fee,
  platform_fee_percent = excluded.platform_fee_percent,
  platform_fee_fixed = excluded.platform_fee_fixed,
  trial_days = excluded.trial_days,
  display_order = excluded.display_order;

-- Funcionários Qomanda (acesso ao portal interno)
create table if not exists staff_users (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  email      text not null,
  name       text,
  role       text not null default 'ops'
             check (role in ('superadmin', 'ops', 'billing', 'support')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists staff_users_email_idx on staff_users (lower(email));

-- Plano vinculado ao restaurante (atalho; fees efetivas ficam em restaurants)
alter table restaurants
  add column if not exists plan_id text references plans(id);

-- Assinatura SaaS por restaurante
create table if not exists restaurant_subscriptions (
  id                          uuid primary key default uuid_generate_v4(),
  restaurant_id               uuid not null unique references restaurants(id) on delete cascade,
  plan_id                     text not null references plans(id),
  status                      text not null default 'trialing'
                              check (status in ('trialing', 'active', 'past_due', 'paused', 'cancelled')),
  trial_ends_at               timestamptz,
  current_period_start        timestamptz,
  current_period_end          timestamptz,
  monthly_fee_override        numeric(10,2),
  platform_fee_percent_override numeric(5,2),
  platform_fee_fixed_override   numeric(10,2),
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists restaurant_subscriptions_status_idx on restaurant_subscriptions (status);

-- Faturas de mensalidade
create table if not exists billing_invoices (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references restaurants(id) on delete cascade,
  subscription_id uuid references restaurant_subscriptions(id) on delete set null,
  period_start    date not null,
  period_end      date not null,
  amount          numeric(10,2) not null check (amount >= 0),
  status          text not null default 'draft'
                  check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date        date,
  paid_at         timestamptz,
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists billing_invoices_restaurant_idx on billing_invoices (restaurant_id, created_at desc);

-- RLS: tabelas internas — apenas service role (sem policies públicas)
alter table plans enable row level security;
alter table staff_users enable row level security;
alter table restaurant_subscriptions enable row level security;
alter table billing_invoices enable row level security;

notify pgrst, 'reload schema';
