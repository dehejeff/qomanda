-- Retenção de dados financeiros (90 dias) + agregados permanentes
-- Detalhes (logs, NF-e, recibos, pedidos/pagamentos) expiram; totais mensais e
-- gasto acumulado do cliente por restaurante permanecem para relatórios.

-- ============================================================
-- 1. Agregados permanentes
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

comment on table restaurant_monthly_stats is
  'Totais mensais permanentes — sobrevivem ao purge de pedidos/pagamentos';

create table if not exists customer_restaurant_totals (
  customer_id       uuid not null references customers(id) on delete cascade,
  restaurant_id       uuid not null references restaurants(id) on delete cascade,
  total_spent         numeric(12,2) not null default 0,
  payment_count       int not null default 0,
  last_payment_at     timestamptz,
  updated_at          timestamptz not null default now(),
  primary key (customer_id, restaurant_id)
);

create index if not exists customer_restaurant_totals_restaurant_idx
  on customer_restaurant_totals (restaurant_id);

comment on table customer_restaurant_totals is
  'Gasto acumulado do cliente no restaurante — permanece após purge de recibos';

-- Log de execuções do purge
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

-- ============================================================
-- 2. Bypass de delete apenas durante purge programado
-- ============================================================
create or replace function fn_block_financial_delete()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('qomanda.retention_purge', true), '') = 'true' then
    return OLD;
  end if;
  raise exception 'Registros financeiros (% %) não podem ser excluídos — use cancelamento ou estorno.',
    TG_TABLE_NAME, OLD.id;
end;
$$;

create or replace function fn_block_audit_mutation()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('qomanda.retention_purge', true), '') = 'true' then
    return OLD;
  end if;
  raise exception 'financial_audit_events é append-only — alteração não permitida.';
end;
$$;

-- ============================================================
-- 3. Rollup mensal + totais do cliente
-- ============================================================
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
    coalesce(sum(case
      when status = 'paid' and method not in ('cash', 'offer') then amount else 0 end), 0),
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
      NEW.customer_id,
      NEW.restaurant_id,
      NEW.amount,
      1,
      coalesce(NEW.paid_at, now()),
      now()
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

-- ============================================================
-- 4. Purge de dados detalhados (> retention_days)
-- ============================================================
create or replace function fn_purge_financial_retention(
  p_retention_days int default 90,
  p_triggered_by text default 'cron'
)
returns financial_retention_runs language plpgsql security definer as $$
declare
  v_cutoff timestamptz;
  v_run financial_retention_runs;
  v_months int := 0;
  v_rec record;
  v_audit int := 0;
  v_snap int := 0;
  v_nfe int := 0;
  v_pay int := 0;
  v_ord int := 0;
  v_items int := 0;
  v_tmp int := 0;
begin
  if p_retention_days < 30 then
    raise exception 'Retenção mínima é 30 dias.';
  end if;

  v_cutoff := now() - (p_retention_days || ' days')::interval;

  -- Rollup de meses completamente anteriores ao cutoff
  for v_rec in
    select distinct
      p.restaurant_id,
      extract(year from coalesce(p.paid_at, p.created_at) at time zone 'America/Sao_Paulo')::int as y,
      extract(month from coalesce(p.paid_at, p.created_at) at time zone 'America/Sao_Paulo')::int as m
    from payments p
    where coalesce(p.paid_at, p.created_at) < v_cutoff
  loop
    perform fn_rollup_restaurant_month(v_rec.restaurant_id, v_rec.y, v_rec.m);
    v_months := v_months + 1;
  end loop;

  for v_rec in
    select distinct
      o.restaurant_id,
      extract(year from o.created_at at time zone 'America/Sao_Paulo')::int as y,
      extract(month from o.created_at at time zone 'America/Sao_Paulo')::int as m
    from orders o
    where o.created_at < v_cutoff
  loop
    perform fn_rollup_restaurant_month(v_rec.restaurant_id, v_rec.y, v_rec.m);
    v_months := v_months + 1;
  end loop;

  perform set_config('qomanda.retention_purge', 'true', true);

  delete from financial_audit_events where created_at < v_cutoff;
  get diagnostics v_audit = row_count;

  delete from nfe_invoices where created_at < v_cutoff;
  get diagnostics v_nfe = row_count;

  delete from payment_receipt_snapshots where paid_at < v_cutoff;
  get diagnostics v_snap = row_count;

  delete from order_items oi
  using orders o
  join sessions s on s.id = o.session_id
  where oi.order_id = o.id
    and o.created_at < v_cutoff
    and s.status = 'closed';
  get diagnostics v_items = row_count;

  delete from orders o
  using sessions s
  where o.session_id = s.id
    and o.created_at < v_cutoff
    and s.status = 'closed';
  get diagnostics v_ord = row_count;

  delete from payments
  where coalesce(paid_at, created_at) < v_cutoff
    and status in ('paid', 'failed', 'refunded');
  get diagnostics v_pay = row_count;

  delete from payments
  where created_at < v_cutoff
    and status in ('pending', 'processing');
  get diagnostics v_tmp = row_count;
  v_pay := v_pay + v_tmp;

  perform set_config('qomanda.retention_purge', '', true);

  insert into financial_retention_runs (
    retention_days, cutoff_at,
    audit_events_deleted, snapshots_deleted, nfe_deleted,
    payments_deleted, orders_deleted, order_items_deleted,
    months_rolled_up, triggered_by
  ) values (
    p_retention_days, v_cutoff,
    v_audit, v_snap, v_nfe,
    v_pay, v_ord, v_items,
    v_months, p_triggered_by
  )
  returning * into v_run;

  return v_run;
end;
$$;

-- ============================================================
-- 5. Backfill agregados a partir do histórico existente
-- ============================================================
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

do $$
declare
  v_rec record;
begin
  for v_rec in
    select distinct
      restaurant_id,
      extract(year from coalesce(paid_at, created_at) at time zone 'America/Sao_Paulo')::int as y,
      extract(month from coalesce(paid_at, created_at) at time zone 'America/Sao_Paulo')::int as m
    from payments
    where status = 'paid'
  loop
    perform fn_rollup_restaurant_month(v_rec.restaurant_id, v_rec.y, v_rec.m);
  end loop;
end $$;

alter table restaurant_monthly_stats enable row level security;
alter table customer_restaurant_totals enable row level security;
alter table financial_retention_runs enable row level security;

notify pgrst, 'reload schema';
