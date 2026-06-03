-- Histórico de upgrade de plano + base para mensalidade proporcional (proration)

create table if not exists subscription_plan_changes (
  id                      uuid primary key default uuid_generate_v4(),
  restaurant_id           uuid not null references restaurants(id) on delete cascade,
  subscription_id         uuid references restaurant_subscriptions(id) on delete set null,
  from_plan_id            text not null references plans(id),
  to_plan_id              text not null references plans(id),
  changed_at              timestamptz not null default now(),
  changed_by              uuid references auth.users(id) on delete set null,
  source                  text not null default 'owner_upgrade'
                          check (source in ('owner_upgrade', 'internal_portal', 'system')),
  old_monthly_fee         numeric(10,2) not null,
  new_monthly_fee         numeric(10,2) not null,
  proration_period_year   int not null,
  proration_period_month  int not null check (proration_period_month between 1 and 12),
  days_in_month           int not null,
  days_on_old_plan        int not null,
  days_on_new_plan        int not null,
  prorated_old_amount     numeric(10,2) not null,
  prorated_new_amount     numeric(10,2) not null,
  notes                   text,
  created_at              timestamptz not null default now()
);

create index if not exists subscription_plan_changes_restaurant_period_idx
  on subscription_plan_changes (restaurant_id, proration_period_year, proration_period_month);

comment on table subscription_plan_changes is 'Log de mudanças de plano; proration usado na fatura mensal';

alter table subscription_plan_changes enable row level security;

notify pgrst, 'reload schema';
