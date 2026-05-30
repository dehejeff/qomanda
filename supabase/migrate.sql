-- ============================================================
-- Qomanda — Script de Migração para banco existente
-- Versão: 1.x → 2.0  |  2026-05-30
--
-- USE ESTE ARQUIVO se o banco já existe e você quer
-- adicionar apenas o que é novo, SEM perder dados.
--
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- Extensões
create extension if not exists "uuid-ossp";

-- ============================================================
-- NOVAS COLUNAS EM TABELAS EXISTENTES
-- ============================================================

-- restaurants: WhatsApp Business API
alter table restaurants
  add column if not exists whatsapp_phone_id     text,
  add column if not exists whatsapp_access_token text,
  add column if not exists whatsapp_nfe_enabled  boolean not null default false;

-- customers: identificação por CPF / passaporte
alter table customers
  add column if not exists document_type text check (document_type in ('cpf','passport')),
  add column if not exists cpf           text unique,
  add column if not exists passport      text;

-- sessions: iniciador do check-in + histórico de trocas
alter table sessions
  add column if not exists customer_id   uuid references customers(id) on delete set null,
  add column if not exists closed_at     timestamptz,
  add column if not exists table_history jsonb not null default '[]';

-- orders: rastreamento por cliente + auto updated_at
alter table orders
  add column if not exists customer_id uuid references customers(id) on delete set null;

-- payments: quem pagou + tipo de split (álcool/alimentação)
alter table payments
  add column if not exists customer_id  uuid references customers(id) on delete set null,
  add column if not exists split_type   text not null default 'combined'
                                        check (split_type in ('food','alcohol','combined'));

-- menu_items: flag de bebida alcoólica
alter table menu_items
  add column if not exists contains_alcohol boolean not null default false;

-- ============================================================
-- NOVAS TABELAS
-- ============================================================

-- Participantes de uma sessão (múltiplos clientes na mesma mesa)
create table if not exists session_participants (
  id          uuid        primary key default uuid_generate_v4(),
  session_id  uuid        not null references sessions(id) on delete cascade,
  customer_id uuid        not null references customers(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  unique(session_id, customer_id)
);

-- Fechamento de conta (iniciativa individual ou mesa toda)
create table if not exists close_requests (
  id           uuid        primary key default uuid_generate_v4(),
  session_id   uuid        not null references sessions(id) on delete cascade,
  initiator_id uuid        not null references customers(id),
  mode         text        not null check (mode in ('individual','table')),
  status       text        not null default 'pending'
                           check (status in ('pending','completed','cancelled')),
  created_at   timestamptz not null default now()
);

create table if not exists close_request_participants (
  id           uuid          primary key default uuid_generate_v4(),
  request_id   uuid          not null references close_requests(id) on delete cascade,
  customer_id  uuid          not null references customers(id),
  amount_owed  numeric(10,2) not null,
  amount_paid  numeric(10,2),
  payment_id   uuid          references payments(id) on delete set null,
  status       text          not null default 'pending'
                             check (status in ('pending','confirmed','paid','declined')),
  confirmed_at timestamptz,
  paid_at      timestamptz,
  unique(request_id, customer_id)
);

-- Visitas dos clientes (base do programa de fidelidade)
create table if not exists customer_visits (
  id            uuid        primary key default uuid_generate_v4(),
  customer_id   uuid        not null references customers(id) on delete cascade,
  restaurant_id uuid        not null references restaurants(id) on delete cascade,
  session_id    uuid        not null references sessions(id) on delete cascade unique,
  created_at    timestamptz not null default now()
);

-- Regras de fidelidade configuradas pelo admin
create table if not exists loyalty_rules (
  id            uuid        primary key default uuid_generate_v4(),
  restaurant_id uuid        not null references restaurants(id) on delete cascade,
  visit_count   int         not null check (visit_count > 0),
  benefit_type  text        not null
                            check (benefit_type in ('free_drink','free_item','discount_pct','custom')),
  benefit_value text        not null,
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- TRIGGERS (create or replace — seguro re-executar)
-- ============================================================

-- Renomeia trigger antigo se existir
drop trigger if exists trg_session_table on sessions;

create or replace function fn_session_table_status()
returns trigger language plpgsql as $$
begin
  if NEW.status = 'open' then
    update tables set status = 'occupied' where id = NEW.table_id;
  elsif NEW.status = 'closed' then
    update tables set status = 'free'     where id = NEW.table_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_session_table_status
after insert or update on sessions
for each row execute function fn_session_table_status();

-- Auto updated_at em orders
create or replace function fn_orders_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at
before update on orders
for each row execute function fn_orders_updated_at();

-- ============================================================
-- ÍNDICES DE PERFORMANCE (if not exists seguro)
-- ============================================================

create index if not exists idx_sessions_table_status         on sessions(table_id, status);
create index if not exists idx_orders_session                on orders(session_id, status);
create index if not exists idx_orders_customer               on orders(customer_id);
create index if not exists idx_order_items_order             on order_items(order_id);
create index if not exists idx_payments_session_status       on payments(session_id, status);
create index if not exists idx_session_participants_session  on session_participants(session_id);
create index if not exists idx_close_req_participants_customer on close_request_participants(customer_id, status);
create index if not exists idx_close_requests_session        on close_requests(session_id, status);
create index if not exists idx_customer_visits_loyalty       on customer_visits(customer_id, restaurant_id);
create index if not exists idx_customers_cpf                 on customers(cpf) where cpf is not null;

-- ============================================================
-- RLS DAS NOVAS TABELAS
-- ============================================================

alter table session_participants       enable row level security;
alter table close_requests             enable row level security;
alter table close_request_participants enable row level security;
alter table customer_visits            enable row level security;
alter table loyalty_rules              enable row level security;

-- Políticas — só cria se não existir
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'session_participants' and policyname = 'public_all'
  ) then
    create policy "public_all" on session_participants for all using (true);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'close_requests' and policyname = 'public_all'
  ) then
    create policy "public_all" on close_requests for all using (true);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'close_request_participants' and policyname = 'public_all'
  ) then
    create policy "public_all" on close_request_participants for all using (true);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'customer_visits' and policyname = 'public_insert'
  ) then
    create policy "public_insert" on customer_visits for insert with check (true);
  end if;

  -- customer_visits: admin vê apenas as visitas do seu restaurante
  if not exists (
    select 1 from pg_policies where tablename = 'customer_visits' and policyname = 'admin_select'
  ) then
    create policy "admin_select" on customer_visits for select
      using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'loyalty_rules' and policyname = 'owner_all'
  ) then
    create policy "owner_all" on loyalty_rules for all
      using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'loyalty_rules' and policyname = 'public_read'
  ) then
    create policy "public_read" on loyalty_rules for select using (active = true);
  end if;
end;
$$;

-- ============================================================
-- PATCH DE SEGURANÇA: remover public_select de customers
-- ============================================================

-- Remove a política antiga de leitura irrestrita (se existir)
drop policy if exists "public_select" on customers;

-- Adiciona política restrita: admin vê apenas clientes do seu restaurante
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'customers' and policyname = 'admin_select'
  ) then
    create policy "admin_select" on customers for select
      using (
        id in (
          select cv.customer_id from customer_visits cv
          join restaurants r on r.id = cv.restaurant_id
          where r.owner_id = auth.uid()
        )
      );
  end if;
end;
$$;

-- Remove public_select de customer_visits
drop policy if exists "public_select" on customer_visits;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- Ative Realtime nas tabelas novas:
--   + close_request_participants
--   + session_participants
--   + payments
-- ============================================================
