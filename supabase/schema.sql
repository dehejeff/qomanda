-- ============================================================
-- Qomanda — Schema SQL para Supabase
-- Executar no SQL Editor do Supabase
-- ============================================================

-- Extensões
create extension if not exists "uuid-ossp";

-- ============================================================
-- RESTAURANTS
-- ============================================================
create table restaurants (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  address     text,
  phone       text,
  status      text not null default 'active' check (status in ('active','inactive')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- TABLES
-- ============================================================
create table tables (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid references restaurants(id) on delete cascade not null,
  number         text not null,
  qr_code_url    text,
  status         text not null default 'free' check (status in ('free','occupied','reserved')),
  created_at     timestamptz not null default now(),
  unique(restaurant_id, number)
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
create table customers (
  id              uuid primary key default uuid_generate_v4(),
  first_name      text not null,
  last_name       text not null,
  whatsapp        text not null unique,
  -- Documento de identificação (opcional — aumenta estabilidade do ID único)
  document_type   text check (document_type in ('cpf', 'passport')),
  cpf             text unique,          -- apenas dígitos, 11 chars
  passport        text,                 -- passaporte para estrangeiros
  created_at      timestamptz not null default now()
);

-- ============================================================
-- SESSIONS
-- ============================================================
create table sessions (
  id             uuid primary key default uuid_generate_v4(),
  table_id       uuid references tables(id) on delete cascade not null,
  restaurant_id  uuid references restaurants(id) on delete cascade not null,
  customer_id    uuid references customers(id) on delete set null,
  status         text not null default 'open' check (status in ('open','closing','closed')),
  started_at     timestamptz not null default now(),
  closed_at      timestamptz,
  -- Histórico de trocas de mesa: [{from: "1", to: "2", at: "ISO"}]
  table_history  jsonb not null default '[]'
);

-- ============================================================
-- LOYALTY RULES  (regras configuradas pelo admin do restaurante)
-- ============================================================
create table loyalty_rules (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid references restaurants(id) on delete cascade not null,
  visit_count    int not null check (visit_count > 0),
  benefit_type   text not null check (benefit_type in ('free_drink','free_item','discount_pct','custom')),
  benefit_value  text not null,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- CLOSE REQUESTS  (iniciativa de fechamento de mesa)
-- ============================================================
create table close_requests (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid references sessions(id) on delete cascade not null,
  initiator_id  uuid references customers(id) not null,
  mode          text not null check (mode in ('individual','table')),
  status        text not null default 'pending'
                  check (status in ('pending','completed','cancelled')),
  created_at    timestamptz not null default now()
);

create table close_request_participants (
  id           uuid primary key default uuid_generate_v4(),
  request_id   uuid references close_requests(id) on delete cascade not null,
  customer_id  uuid references customers(id) not null,
  amount_owed  numeric(10,2) not null,   -- cota calculada
  amount_paid  numeric(10,2),            -- pode ser maior que amount_owed
  status       text not null default 'pending'
                 check (status in ('pending','confirmed','paid','declined')),
  confirmed_at timestamptz,
  paid_at      timestamptz,
  unique(request_id, customer_id)
);

-- ============================================================
-- CUSTOMER VISITS  (base para programa de fidelidade)
-- ============================================================
create table customer_visits (
  id             uuid primary key default uuid_generate_v4(),
  customer_id    uuid references customers(id) on delete cascade not null,
  restaurant_id  uuid references restaurants(id) on delete cascade not null,
  session_id     uuid references sessions(id) on delete cascade not null unique,
  created_at     timestamptz not null default now()
);

-- Quando uma sessão abre, marca a mesa como ocupada
create or replace function fn_session_open_table()
returns trigger language plpgsql as $$
begin
  if NEW.status = 'open' then
    update tables set status = 'occupied' where id = NEW.table_id;
  elsif NEW.status = 'closed' then
    update tables set status = 'free' where id = NEW.table_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_session_table
after insert or update on sessions
for each row execute function fn_session_open_table();

-- ============================================================
-- SESSION PARTICIPANTS  (múltiplos clientes na mesma mesa/sessão)
-- ============================================================
create table session_participants (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid references sessions(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete cascade not null,
  joined_at   timestamptz not null default now(),
  unique(session_id, customer_id)
);

-- ============================================================
-- MENU CATEGORIES
-- ============================================================
create table menu_categories (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid references restaurants(id) on delete cascade not null,
  name           text not null,
  display_order  int not null default 0,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- MENU ITEMS
-- ============================================================
create table menu_items (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid references restaurants(id) on delete cascade not null,
  category_id    uuid references menu_categories(id) on delete cascade not null,
  name           text not null,
  description    text,
  price          numeric(10,2) not null check (price >= 0),
  image_url      text,
  available      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- ORDERS
-- ============================================================
create table orders (
  id             uuid primary key default uuid_generate_v4(),
  session_id     uuid references sessions(id) on delete cascade not null,
  restaurant_id  uuid references restaurants(id) on delete cascade not null,
  customer_id    uuid references customers(id) on delete set null,  -- quem fez o pedido
  status         text not null default 'pending'
                   check (status in ('pending','confirmed','preparing','ready','delivered','cancelled')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
create table order_items (
  id            uuid primary key default uuid_generate_v4(),
  order_id      uuid references orders(id) on delete cascade not null,
  menu_item_id  uuid references menu_items(id) not null,
  quantity      int not null check (quantity > 0),
  unit_price    numeric(10,2) not null,
  notes         text
);

-- ============================================================
-- PAYMENTS
-- ============================================================
create table payments (
  id                        uuid primary key default uuid_generate_v4(),
  session_id                uuid references sessions(id) on delete cascade not null,
  restaurant_id             uuid references restaurants(id) on delete cascade not null,
  stripe_payment_intent_id  text,
  amount                    numeric(10,2) not null check (amount > 0),
  method                    text not null check (method in ('credit','debit','pix')),
  status                    text not null default 'pending'
                              check (status in ('pending','processing','paid','failed','refunded')),
  confirmation_code         text unique,
  created_at                timestamptz not null default now(),
  paid_at                   timestamptz
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table restaurants      enable row level security;
alter table tables           enable row level security;
alter table customers        enable row level security;
alter table sessions         enable row level security;
alter table customer_visits  enable row level security;
alter table menu_categories  enable row level security;
alter table menu_items       enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;
alter table payments         enable row level security;

-- Loyalty rules: dono do restaurante gerencia
alter table loyalty_rules enable row level security;
create policy "owner_all" on loyalty_rules for all
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Close requests: público
alter table close_requests enable row level security;
create policy "public_all" on close_requests for all using (true);
alter table close_request_participants enable row level security;
create policy "public_all" on close_request_participants for all using (true);

-- Session participants: público
alter table session_participants enable row level security;
create policy "public_all" on session_participants for all using (true);

-- Customers: público insere e consulta o próprio (por whatsapp)
create policy "public_insert" on customers for insert with check (true);
create policy "public_select" on customers for select using (true);

-- Customer visits: público insere, dono do restaurante consulta
create policy "public_insert" on customer_visits for insert with check (true);
create policy "public_select" on customer_visits for select using (true);

-- Restaurantes: dono vê/edita o próprio
create policy "owner_all" on restaurants for all using (owner_id = auth.uid());

-- Tabelas: dono do restaurante gerencia
create policy "owner_all" on tables for all
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Menu público para leitura (clientes sem auth)
create policy "public_read" on menu_categories for select using (true);
create policy "public_read" on menu_items for select using (true);
create policy "owner_all" on menu_categories for all
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
create policy "owner_all" on menu_items for all
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Sessões: clientes criam, dono visualiza
create policy "public_insert" on sessions for insert with check (true);
create policy "public_select" on sessions for select using (true);
create policy "owner_update" on sessions for update
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Pedidos: público insere e consulta, dono atualiza
create policy "public_insert" on orders for insert with check (true);
create policy "public_select" on orders for select using (true);
create policy "owner_update" on orders for update
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Order items: público
create policy "public_all" on order_items for all using (true);

-- Payments
create policy "public_insert" on payments for insert with check (true);
create policy "public_select" on payments for select using (true);
create policy "owner_update" on payments for update
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- ============================================================
-- REALTIME (habilitar nas tabelas necessárias)
-- ============================================================
-- No Supabase Dashboard > Database > Replication, habilitar para:
-- orders, order_items, sessions, tables
