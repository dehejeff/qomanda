-- Preservação e auditoria de pedidos e pagamentos
-- Impede exclusão acidental (CASCADE), registra eventos append-only e
-- congela snapshot de recibo quando o pagamento é confirmado.

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
