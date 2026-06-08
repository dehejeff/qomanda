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
                check (role in ('owner', 'waiter', 'kitchen', 'manager', 'caixa', 'recepcionista')),
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

-- ===== migrate-mercadopago-gateway.sql =====
alter table restaurants drop constraint if exists restaurants_payment_gateway_provider_check;

alter table restaurants
  add constraint restaurants_payment_gateway_provider_check
  check (payment_gateway_provider is null or payment_gateway_provider in ('manual', 'asaas', 'mercado_pago'));

notify pgrst, 'reload schema';

-- ===== migrate-subscription-plan-changes.sql =====
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

alter table subscription_plan_changes enable row level security;

notify pgrst, 'reload schema';

-- ===== migrate-financial-audit-retention.sql =====
create extension if not exists pgcrypto;

-- ============================================================
-- 1. Tabela de auditoria (append-only)
-- ============================================================
create table if not exists financial_audit_events (
  id              uuid primary key default uuid_generate_v4(),
  entity_type     text not null check (entity_type in ('order', 'order_item', 'payment')),
  entity_id       uuid not null,
  event_type      text not null check (event_type in (
    'created', 'updated', 'status_changed', 'paid', 'refunded', 'failed', 'cancelled'
  )),
  restaurant_id   uuid references restaurants(id) on delete set null,
  session_id      uuid references sessions(id) on delete set null,
  customer_id     uuid references customers(id) on delete set null,
  actor_type      text not null default 'system'
                  check (actor_type in ('customer', 'owner', 'staff', 'system', 'webhook')),
  actor_id        uuid,
  previous_status text,
  new_status      text,
  payload         jsonb not null default '{}'::jsonb,
  integrity_hash  text not null,
  created_at      timestamptz not null default now()
);

create index if not exists financial_audit_events_restaurant_created_idx
  on financial_audit_events (restaurant_id, created_at desc);

create index if not exists financial_audit_events_entity_idx
  on financial_audit_events (entity_type, entity_id, created_at desc);

create index if not exists financial_audit_events_session_idx
  on financial_audit_events (session_id, created_at desc)
  where session_id is not null;

comment on table financial_audit_events is
  'Log imutável de pedidos/pagamentos para recibos do cliente e disputas com restaurantes';

-- ============================================================
-- 2. Snapshot de recibo (congelado no pagamento confirmado)
-- ============================================================
create table if not exists payment_receipt_snapshots (
  payment_id            uuid primary key references payments(id) on delete restrict,
  restaurant_id         uuid not null references restaurants(id) on delete restrict,
  customer_id           uuid references customers(id) on delete set null,
  session_id            uuid not null references sessions(id) on delete restrict,
  restaurant_name       text not null,
  restaurant_slug       text not null,
  logo_url              text,
  table_number          text not null default '—',
  amount                numeric(10,2) not null,
  method                text not null,
  split_type            text not null,
  service_fee_included  boolean not null default true,
  confirmation_code     text,
  paid_at               timestamptz not null,
  commission_rate       numeric(5,4),
  commission_amount     numeric(10,2),
  commission_exempt     boolean not null default false,
  gateway_payment_id    text,
  orders_snapshot       jsonb not null default '[]'::jsonb,
  content_hash          text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists payment_receipt_snapshots_customer_paid_idx
  on payment_receipt_snapshots (customer_id, paid_at desc)
  where customer_id is not null;

create index if not exists payment_receipt_snapshots_restaurant_paid_idx
  on payment_receipt_snapshots (restaurant_id, paid_at desc);

comment on table payment_receipt_snapshots is
  'Cópia imutável do recibo no momento do pagamento — sobrevive a mudanças na mesa/sessão';

-- ============================================================
-- 3. FKs: RESTRICT em vez de CASCADE (pedidos/pagamentos)
-- ============================================================
alter table orders drop constraint if exists orders_session_id_fkey;
alter table orders
  add constraint orders_session_id_fkey
  foreign key (session_id) references sessions(id) on delete restrict;

alter table orders drop constraint if exists orders_restaurant_id_fkey;
alter table orders
  add constraint orders_restaurant_id_fkey
  foreign key (restaurant_id) references restaurants(id) on delete restrict;

alter table order_items drop constraint if exists order_items_order_id_fkey;
alter table order_items
  add constraint order_items_order_id_fkey
  foreign key (order_id) references orders(id) on delete restrict;

alter table payments drop constraint if exists payments_session_id_fkey;
alter table payments
  add constraint payments_session_id_fkey
  foreign key (session_id) references sessions(id) on delete restrict;

alter table payments drop constraint if exists payments_restaurant_id_fkey;
alter table payments
  add constraint payments_restaurant_id_fkey
  foreign key (restaurant_id) references restaurants(id) on delete restrict;

-- ============================================================
-- 4. Funções auxiliares
-- ============================================================
create or replace function fn_financial_integrity_hash(
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_payload jsonb
)
returns text language plpgsql as $$
begin
  return encode(
    digest(
      coalesce(p_entity_type, '') || '|' ||
      coalesce(p_entity_id::text, '') || '|' ||
      coalesce(p_event_type, '') || '|' ||
      coalesce(p_payload::text, '{}') || '|' ||
      extract(epoch from now())::text,
      'sha256'
    ),
    'hex'
  );
end;
$$;

create or replace function fn_block_financial_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'Registros financeiros (% %) não podem ser excluídos — use cancelamento ou estorno.',
    TG_TABLE_NAME, OLD.id;
end;
$$;

create or replace function fn_protect_paid_payment()
returns trigger language plpgsql as $$
begin
  if OLD.status in ('paid', 'refunded') then
    if NEW.amount is distinct from OLD.amount
      or NEW.method is distinct from OLD.method
      or NEW.session_id is distinct from OLD.session_id
      or NEW.customer_id is distinct from OLD.customer_id
      or NEW.restaurant_id is distinct from OLD.restaurant_id
      or NEW.split_type is distinct from OLD.split_type
      or NEW.confirmation_code is distinct from OLD.confirmation_code
      or NEW.paid_at is distinct from OLD.paid_at
      or NEW.service_fee_included is distinct from OLD.service_fee_included
    then
      raise exception 'Campos financeiros do pagamento % não podem ser alterados após confirmação.', OLD.id;
    end if;

    if OLD.status = 'refunded' and NEW.status is distinct from OLD.status then
      raise exception 'Pagamento estornado % não pode mudar de status.', OLD.id;
    end if;

    if OLD.status = 'paid' and NEW.status is distinct from OLD.status and NEW.status <> 'refunded' then
      raise exception 'Pagamento confirmado % só pode ir para estornado.', OLD.id;
    end if;
  end if;

  return NEW;
end;
$$;

create or replace function fn_financial_audit_log()
returns trigger language plpgsql security definer as $$
declare
  v_entity_type text := TG_ARGV[0];
  v_event_type text;
  v_payload jsonb;
  v_restaurant_id uuid;
  v_session_id uuid;
  v_customer_id uuid;
  v_prev_status text;
  v_new_status text;
  v_hash text;
begin
  if TG_OP = 'INSERT' then
    v_event_type := 'created';
    v_payload := jsonb_build_object('new', to_jsonb(NEW));
    v_restaurant_id := NEW.restaurant_id;
    v_session_id := NEW.session_id;
    v_customer_id := NEW.customer_id;
    v_new_status := NEW.status;
  elsif TG_OP = 'UPDATE' then
    v_payload := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    v_restaurant_id := coalesce(NEW.restaurant_id, OLD.restaurant_id);
    v_session_id := coalesce(NEW.session_id, OLD.session_id);
    v_customer_id := coalesce(NEW.customer_id, OLD.customer_id);
    v_prev_status := OLD.status;
    v_new_status := NEW.status;

    if OLD.status is distinct from NEW.status then
      v_event_type := case NEW.status
        when 'paid' then 'paid'
        when 'refunded' then 'refunded'
        when 'failed' then 'failed'
        when 'cancelled' then 'cancelled'
        else 'status_changed'
      end;
    else
      v_event_type := 'updated';
    end if;
  else
    return OLD;
  end if;

  v_hash := fn_financial_integrity_hash(v_entity_type, NEW.id, v_event_type, v_payload);

  insert into financial_audit_events (
    entity_type, entity_id, event_type,
    restaurant_id, session_id, customer_id,
    previous_status, new_status, payload, integrity_hash
  ) values (
    v_entity_type, NEW.id, v_event_type,
    v_restaurant_id, v_session_id, v_customer_id,
    v_prev_status, v_new_status, v_payload, v_hash
  );

  return NEW;
end;
$$;

create or replace function fn_order_items_audit_log()
returns trigger language plpgsql security definer as $$
declare
  v_order record;
  v_payload jsonb;
  v_hash text;
begin
  if TG_OP = 'INSERT' then
    select o.restaurant_id, o.session_id, o.customer_id
    into v_order
    from orders o where o.id = NEW.order_id;

    v_payload := jsonb_build_object('new', to_jsonb(NEW));
    v_hash := fn_financial_integrity_hash('order_item', NEW.id, 'created', v_payload);

    insert into financial_audit_events (
      entity_type, entity_id, event_type,
      restaurant_id, session_id, customer_id,
      payload, integrity_hash
    ) values (
      'order_item', NEW.id, 'created',
      v_order.restaurant_id, v_order.session_id, v_order.customer_id,
      v_payload, v_hash
    );
    return NEW;
  elsif TG_OP = 'UPDATE' then
    select o.restaurant_id, o.session_id, o.customer_id
    into v_order
    from orders o where o.id = NEW.order_id;

    v_payload := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    v_hash := fn_financial_integrity_hash('order_item', NEW.id, 'updated', v_payload);

    insert into financial_audit_events (
      entity_type, entity_id, event_type,
      restaurant_id, session_id, customer_id,
      payload, integrity_hash
    ) values (
      'order_item', NEW.id, 'updated',
      v_order.restaurant_id, v_order.session_id, v_order.customer_id,
      v_payload, v_hash
    );
    return NEW;
  end if;

  return OLD;
end;
$$;

create or replace function fn_build_session_orders_snapshot(p_session_id uuid)
returns jsonb language sql stable as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'order_id', o.id,
        'customer_id', o.customer_id,
        'status', o.status,
        'created_at', o.created_at,
        'items', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'menu_item_id', oi.menu_item_id,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              'notes', oi.notes
            )
          ), '[]'::jsonb)
          from order_items oi where oi.order_id = o.id
        )
      )
      order by o.created_at
    ),
    '[]'::jsonb
  )
  from orders o
  where o.session_id = p_session_id
    and o.status <> 'cancelled';
$$;

create or replace function fn_payment_receipt_snapshot()
returns trigger language plpgsql security definer as $$
declare
  v_restaurant record;
  v_table_number text := '—';
  v_orders jsonb;
  v_content jsonb;
  v_hash text;
begin
  if NEW.status = 'paid' and (TG_OP = 'INSERT' or OLD.status is distinct from NEW.status) then
    select r.name, r.slug, r.logo_url
    into v_restaurant
    from restaurants r
    where r.id = NEW.restaurant_id;

    select coalesce(t.number::text, '—')
    into v_table_number
    from sessions s
    left join tables t on t.id = s.table_id
    where s.id = NEW.session_id;

    v_orders := fn_build_session_orders_snapshot(NEW.session_id);

    v_content := jsonb_build_object(
      'payment_id', NEW.id,
      'restaurant_id', NEW.restaurant_id,
      'amount', NEW.amount,
      'method', NEW.method,
      'confirmation_code', NEW.confirmation_code,
      'paid_at', NEW.paid_at,
      'orders', v_orders
    );

    v_hash := encode(digest(v_content::text, 'sha256'), 'hex');

    insert into payment_receipt_snapshots (
      payment_id, restaurant_id, customer_id, session_id,
      restaurant_name, restaurant_slug, logo_url, table_number,
      amount, method, split_type, service_fee_included,
      confirmation_code, paid_at,
      commission_rate, commission_amount, commission_exempt,
      gateway_payment_id, orders_snapshot, content_hash
    ) values (
      NEW.id, NEW.restaurant_id, NEW.customer_id, NEW.session_id,
      coalesce(v_restaurant.name, 'Restaurante'),
      coalesce(v_restaurant.slug, ''),
      v_restaurant.logo_url,
      v_table_number,
      NEW.amount, NEW.method, NEW.split_type, coalesce(NEW.service_fee_included, true),
      NEW.confirmation_code, coalesce(NEW.paid_at, now()),
      NEW.commission_rate, NEW.commission_amount, coalesce(NEW.commission_exempt, false),
      NEW.asaas_payment_id, v_orders, v_hash
    )
    on conflict (payment_id) do update set
      commission_rate = excluded.commission_rate,
      commission_amount = excluded.commission_amount,
      commission_exempt = excluded.commission_exempt,
      gateway_payment_id = coalesce(excluded.gateway_payment_id, payment_receipt_snapshots.gateway_payment_id),
      orders_snapshot = excluded.orders_snapshot,
      content_hash = excluded.content_hash,
      updated_at = now();
  end if;

  return NEW;
end;
$$;

create or replace function fn_block_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'financial_audit_events é append-only — alteração não permitida.';
end;
$$;

-- ============================================================
-- 5. Triggers
-- ============================================================
drop trigger if exists trg_block_orders_delete on orders;
create trigger trg_block_orders_delete
before delete on orders
for each row execute function fn_block_financial_delete();

drop trigger if exists trg_block_payments_delete on payments;
create trigger trg_block_payments_delete
before delete on payments
for each row execute function fn_block_financial_delete();

drop trigger if exists trg_block_order_items_delete on order_items;
create trigger trg_block_order_items_delete
before delete on order_items
for each row execute function fn_block_financial_delete();

drop trigger if exists trg_protect_paid_payment on payments;
create trigger trg_protect_paid_payment
before update on payments
for each row execute function fn_protect_paid_payment();

drop trigger if exists trg_audit_orders on orders;
create trigger trg_audit_orders
after insert or update on orders
for each row execute function fn_financial_audit_log('order');

drop trigger if exists trg_audit_payments on payments;
create trigger trg_audit_payments
after insert or update on payments
for each row execute function fn_financial_audit_log('payment');

drop trigger if exists trg_audit_order_items on order_items;
create trigger trg_audit_order_items
after insert or update on order_items
for each row execute function fn_order_items_audit_log();

drop trigger if exists trg_payment_receipt_snapshot on payments;
create trigger trg_payment_receipt_snapshot
after insert or update on payments
for each row execute function fn_payment_receipt_snapshot();

drop trigger if exists trg_block_audit_update on financial_audit_events;
create trigger trg_block_audit_update
before update or delete on financial_audit_events
for each row execute function fn_block_audit_mutation();

drop trigger if exists trg_block_snapshot_delete on payment_receipt_snapshots;
create trigger trg_block_snapshot_delete
before delete on payment_receipt_snapshots
for each row execute function fn_block_financial_delete();

-- ============================================================
-- 6. Backfill: snapshots para pagamentos já confirmados
-- ============================================================
insert into payment_receipt_snapshots (
  payment_id, restaurant_id, customer_id, session_id,
  restaurant_name, restaurant_slug, logo_url, table_number,
  amount, method, split_type, service_fee_included,
  confirmation_code, paid_at,
  commission_rate, commission_amount, commission_exempt,
  gateway_payment_id, orders_snapshot, content_hash
)
select
  p.id,
  p.restaurant_id,
  p.customer_id,
  p.session_id,
  coalesce(r.name, 'Restaurante'),
  coalesce(r.slug, ''),
  r.logo_url,
  coalesce(t.number::text, '—'),
  p.amount,
  p.method,
  p.split_type,
  coalesce(p.service_fee_included, true),
  p.confirmation_code,
  coalesce(p.paid_at, p.created_at),
  p.commission_rate,
  p.commission_amount,
  coalesce(p.commission_exempt, false),
  p.asaas_payment_id,
  fn_build_session_orders_snapshot(p.session_id),
  encode(digest(
    jsonb_build_object(
      'payment_id', p.id,
      'amount', p.amount,
      'paid_at', coalesce(p.paid_at, p.created_at)
    )::text,
    'sha256'
  ), 'hex')
from payments p
left join restaurants r on r.id = p.restaurant_id
left join sessions s on s.id = p.session_id
left join tables t on t.id = s.table_id
where p.status = 'paid'
on conflict (payment_id) do nothing;

alter table financial_audit_events enable row level security;
alter table payment_receipt_snapshots enable row level security;

notify pgrst, 'reload schema';

-- ===== migrate-financial-retention.sql =====
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
  get diagnostics v_pay = v_pay + row_count;

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

-- ===== migrate-nfe-retention-reminders.sql =====
-- Lembretes de retenção de NF-e (20, 15 e 5 dias antes da exclusão)
-- Notificações in-app + log de e-mails enviados

create table if not exists restaurant_notifications (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references restaurants(id) on delete cascade,
  type            text not null check (type in ('nfe_retention')),
  title           text not null,
  body            text not null,
  link            text,
  severity        text not null default 'warning'
                  check (severity in ('info', 'warning', 'critical')),
  metadata        jsonb not null default '{}'::jsonb,
  read_at         timestamptz,
  dismissed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists restaurant_notifications_restaurant_unread_idx
  on restaurant_notifications (restaurant_id, created_at desc)
  where read_at is null and dismissed_at is null;

comment on table restaurant_notifications is
  'Alertas no painel do restaurante (retenção NF-e, etc.)';

create table if not exists nfe_retention_reminder_log (
  id                uuid primary key default uuid_generate_v4(),
  restaurant_id     uuid not null references restaurants(id) on delete cascade,
  days_before       int not null check (days_before in (20, 15, 5)),
  scheduled_for     date not null,
  nfe_count         int not null default 0,
  purge_on          date not null,
  notification_id   uuid references restaurant_notifications(id) on delete set null,
  email_sent        boolean not null default false,
  email_to          text,
  email_error       text,
  created_at        timestamptz not null default now(),
  unique (restaurant_id, days_before, scheduled_for)
);

create index if not exists nfe_retention_reminder_log_restaurant_idx
  on nfe_retention_reminder_log (restaurant_id, created_at desc);

comment on table nfe_retention_reminder_log is
  'Evita reenvio de lembretes 20/15/5 dias antes da exclusão de NF-e';

alter table restaurant_notifications enable row level security;
alter table nfe_retention_reminder_log enable row level security;

notify pgrst, 'reload schema';
