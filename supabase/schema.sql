-- ============================================================
-- Qomanda — Schema SQL completo para Supabase
-- Versão: 2.0  |  Atualizado: 2026-05-30
--
-- INSTRUÇÕES:
--   • Banco vazio (primeira vez):   execute este arquivo inteiro
--   • Banco já existente:           execute supabase/migrate.sql
--   • Resetar tudo (⚠️ apaga dados): execute supabase/reset.sql primeiro
--
--   Depois de executar: ative Realtime nas tabelas indicadas no final
-- ============================================================

-- Extensões necessárias
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. RESTAURANTES
--    Cada restaurante tem um owner (auth.users) e um slug único
--    que é usado na URL do cliente: /{slug}?mesa={n}
-- ============================================================
create table if not exists restaurants (
  id                    uuid        primary key default uuid_generate_v4(),
  owner_id              uuid        not null references auth.users(id) on delete cascade,
  name                  text        not null,
  slug                  text        not null unique,
  logo_url              text,
  address               text,
  phone                 text,
  status                text        not null default 'active'
                                    check (status in ('active','inactive')),

  -- WhatsApp Business API (Meta Cloud API)
  -- Obter em: Meta for Developers → WhatsApp → API Setup
  -- ATENÇÃO: armazenar o token criptografado em produção
  whatsapp_phone_id     text,
  whatsapp_access_token text,
  whatsapp_nfe_enabled  boolean     not null default false,

  created_at            timestamptz not null default now()
);

-- ============================================================
-- 2. MESAS
--    Cada mesa tem um número único por restaurante e um QR Code
--    gerado em: /{slug}?mesa={number}
-- ============================================================
create table if not exists tables (
  id            uuid        primary key default uuid_generate_v4(),
  restaurant_id uuid        not null references restaurants(id) on delete cascade,
  number        text        not null,
  qr_code_url   text,
  status        text        not null default 'free'
                            check (status in ('free','occupied','reserved')),
  created_at    timestamptz not null default now(),
  unique(restaurant_id, number)
);

-- ============================================================
-- 3. CLIENTES
--    Identificação primária: WhatsApp (único)
--    Identificação secundária: CPF ou Passaporte (opcional)
--    O CPF garante continuidade do histórico mesmo com troca de número
-- ============================================================
create table if not exists customers (
  id            uuid        primary key default uuid_generate_v4(),
  first_name    text        not null,
  last_name     text        not null,
  whatsapp      text        not null unique,  -- dígitos apenas
  document_type text        check (document_type in ('cpf','passport')),
  cpf           text        unique,           -- 11 dígitos, sem formatação
  passport      text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 4. SESSÕES
--    Uma sessão = uma ocupação de mesa.
--    Múltiplos clientes podem participar da mesma sessão (ver session_participants).
--    customer_id = quem abriu a sessão (primeiro a fazer check-in).
-- ============================================================
create table if not exists sessions (
  id            uuid        primary key default uuid_generate_v4(),
  table_id      uuid        not null references tables(id) on delete cascade,
  restaurant_id uuid        not null references restaurants(id) on delete cascade,
  customer_id   uuid        references customers(id) on delete set null,
  status        text        not null default 'open'
                            check (status in ('open','closing','closed')),
  started_at    timestamptz not null default now(),
  closed_at     timestamptz,
  -- Histórico de trocas de mesa (para auditoria)
  -- Formato: [{"from": "3", "to": "5", "at": "2026-05-30T20:00:00Z"}]
  table_history jsonb       not null default '[]'
);

-- Trigger: sincroniza status da mesa com o status da sessão
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

-- ============================================================
-- 5. PARTICIPANTES DA SESSÃO
--    Rastreia todos os clientes que fizeram check-in na mesma mesa.
--    Base para: divisão de conta, identificação de pedidos por pessoa.
-- ============================================================
create table if not exists session_participants (
  id          uuid        primary key default uuid_generate_v4(),
  session_id  uuid        not null references sessions(id) on delete cascade,
  customer_id uuid        not null references customers(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  unique(session_id, customer_id)
);

-- ============================================================
-- 6. CATEGORIAS DO CARDÁPIO
-- ============================================================
create table if not exists menu_categories (
  id            uuid        primary key default uuid_generate_v4(),
  restaurant_id uuid        not null references restaurants(id) on delete cascade,
  name          text        not null,
  display_order int         not null default 0,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 7. ITENS DO CARDÁPIO
--    contains_alcohol: separa reembolso empresa (alimentação) vs pessoal (bebidas)
-- ============================================================
create table if not exists menu_items (
  id               uuid           primary key default uuid_generate_v4(),
  restaurant_id    uuid           not null references restaurants(id) on delete cascade,
  category_id      uuid           not null references menu_categories(id) on delete cascade,
  name             text           not null,
  description      text,
  price            numeric(10,2)  not null check (price >= 0),
  image_url        text,
  available        boolean        not null default true,
  contains_alcohol boolean        not null default false,
  created_at       timestamptz    not null default now()
);

-- ============================================================
-- 8. PEDIDOS
--    customer_id: quem fez o pedido (null = pedido sem identificação)
--    Permite separar "Minha Conta" de "Mesa Toda" na tela do cliente.
-- ============================================================
create table if not exists orders (
  id            uuid        primary key default uuid_generate_v4(),
  session_id    uuid        not null references sessions(id) on delete cascade,
  restaurant_id uuid        not null references restaurants(id) on delete cascade,
  customer_id   uuid        references customers(id) on delete set null,
  status        text        not null default 'pending'
                            check (status in (
                              'pending','confirmed','preparing',
                              'ready','delivered','cancelled'
                            )),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Trigger: atualiza updated_at automaticamente a cada mudança de status
create or replace function fn_orders_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

create trigger trg_orders_updated_at
before update on orders
for each row execute function fn_orders_updated_at();

-- ============================================================
-- 9. ITENS DO PEDIDO
-- ============================================================
create table if not exists order_items (
  id           uuid          primary key default uuid_generate_v4(),
  order_id     uuid          not null references orders(id) on delete cascade,
  menu_item_id uuid          not null references menu_items(id),
  quantity     int           not null check (quantity > 0),
  unit_price   numeric(10,2) not null,  -- preço no momento do pedido
  notes        text
);

-- ============================================================
-- 10. PAGAMENTOS
--     customer_id: quem efetuou o pagamento
--     split_type: separação para reembolso corporativo
--       'combined' = conta única (padrão)
--       'food'     = apenas alimentação (reembolsável pela empresa)
--       'alcohol'  = apenas bebidas alcoólicas (conta pessoal)
-- ============================================================
create table if not exists payments (
  id                       uuid          primary key default uuid_generate_v4(),
  session_id               uuid          not null references sessions(id) on delete cascade,
  restaurant_id            uuid          not null references restaurants(id) on delete cascade,
  customer_id              uuid          references customers(id) on delete set null,
  stripe_payment_intent_id text,
  amount                   numeric(10,2) not null check (amount > 0),
  method                   text          not null check (method in ('credit','debit','pix')),
  split_type               text          not null default 'combined'
                                         check (split_type in ('food','alcohol','combined')),
  status                   text          not null default 'pending'
                                         check (status in (
                                           'pending','processing','paid','failed','refunded'
                                         )),
  confirmation_code        text          unique,
  created_at               timestamptz   not null default now(),
  paid_at                  timestamptz
);

-- ============================================================
-- 11. FECHAMENTO DE CONTA
--     close_requests: iniciativa de fechamento (individual ou mesa toda)
--     close_request_participants: quem divide, quanto cada um deve e pagou
--     Regra anti-fraude: initiator_id não pode ser desmarcado pelo UI
-- ============================================================
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
  amount_owed  numeric(10,2) not null,    -- cota definida pelo iniciador
  amount_paid  numeric(10,2),             -- pode ser >= amount_owed
  payment_id   uuid          references payments(id) on delete set null,
  status       text          not null default 'pending'
                             check (status in ('pending','confirmed','paid','declined')),
  confirmed_at timestamptz,
  paid_at      timestamptz,
  unique(request_id, customer_id)
);

-- ============================================================
-- 12. FIDELIDADE
--     loyalty_rules: regras configuradas pelo admin
--     customer_visits: uma visita por sessão por restaurante
--
--     Contagem de visitas: SELECT COUNT(*) FROM customer_visits
--       WHERE customer_id = X AND restaurant_id = Y
-- ============================================================
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

create table if not exists customer_visits (
  id            uuid        primary key default uuid_generate_v4(),
  customer_id   uuid        not null references customers(id) on delete cascade,
  restaurant_id uuid        not null references restaurants(id) on delete cascade,
  session_id    uuid        not null references sessions(id) on delete cascade unique,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================

-- Encontrar sessão aberta de uma mesa (check-in)
create index idx_sessions_table_status
  on sessions(table_id, status);

-- Pedidos de uma sessão (mesa toda / minha conta)
create index idx_orders_session
  on orders(session_id, status);

-- Pedidos de um cliente específico
create index idx_orders_customer
  on orders(customer_id);

-- Itens de um pedido
create index idx_order_items_order
  on order_items(order_id);

-- Pagamentos de uma sessão (saldo da mesa)
create index idx_payments_session_status
  on payments(session_id, status);

-- Participantes de uma sessão (divisão de conta)
create index idx_session_participants_session
  on session_participants(session_id);

-- Notificações de fechamento para um cliente
create index idx_close_req_participants_customer
  on close_request_participants(customer_id, status);

-- Close request ativa de uma sessão
create index idx_close_requests_session
  on close_requests(session_id, status);

-- Contagem de visitas para fidelidade
create index idx_customer_visits_loyalty
  on customer_visits(customer_id, restaurant_id);

-- Busca de cliente por CPF (upsert no check-in)
create index idx_customers_cpf
  on customers(cpf)
  where cpf is not null;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table restaurants              enable row level security;
alter table tables                   enable row level security;
alter table customers                enable row level security;
alter table sessions                 enable row level security;
alter table session_participants     enable row level security;
alter table menu_categories          enable row level security;
alter table menu_items               enable row level security;
alter table orders                   enable row level security;
alter table order_items              enable row level security;
alter table payments                 enable row level security;
alter table close_requests           enable row level security;
alter table close_request_participants enable row level security;
alter table loyalty_rules            enable row level security;
alter table customer_visits          enable row level security;

-- Restaurantes: dono gerencia o próprio
create policy "owner_all" on restaurants
  for all using (owner_id = auth.uid());

-- Mesas: dono gerencia as mesas do seu restaurante
create policy "owner_all" on tables
  for all using (
    restaurant_id in (select id from restaurants where owner_id = auth.uid())
  );

-- Clientes: qualquer um pode criar e consultar (sem auth)
create policy "public_insert" on customers for insert with check (true);
create policy "public_select" on customers for select using (true);
-- Apenas o cliente pode editar seu próprio registro (via whatsapp como chave)
-- (em produção: implementar autenticação de cliente por OTP de WhatsApp)

-- Sessões: clientes criam, consultas são públicas, dono atualiza
create policy "public_insert" on sessions for insert with check (true);
create policy "public_select" on sessions for select using (true);
create policy "owner_update"  on sessions for update
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Participantes: público (clientes sem auth participam de sessões)
create policy "public_all" on session_participants for all using (true);

-- Cardápio: leitura pública, escrita apenas pelo dono
create policy "public_read" on menu_categories for select using (true);
create policy "public_read" on menu_items      for select using (true);
create policy "owner_all"   on menu_categories for all
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
create policy "owner_all"   on menu_items for all
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Pedidos: clientes criam e consultam, dono atualiza status
create policy "public_insert" on orders for insert with check (true);
create policy "public_select" on orders for select using (true);
create policy "owner_update"  on orders for update
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Itens do pedido: público (leitura e escrita por clientes)
create policy "public_all" on order_items for all using (true);

-- Pagamentos: clientes criam, consulta pública, dono atualiza (confirma)
create policy "public_insert" on payments for insert with check (true);
create policy "public_select" on payments for select using (true);
create policy "owner_update"  on payments for update
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Fechamento de conta: público (clientes sem auth iniciam e confirmam)
create policy "public_all" on close_requests             for all using (true);
create policy "public_all" on close_request_participants for all using (true);

-- Fidelidade: dono gerencia as regras, consulta pública para o cliente
create policy "owner_all"     on loyalty_rules for all
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
create policy "public_insert" on customer_visits for insert with check (true);
create policy "public_select" on customer_visits for select using (true);

-- ============================================================
-- REALTIME — ATIVAR NO SUPABASE DASHBOARD
-- ============================================================
-- Dashboard → Database → Replication → Tables
-- Habilitar para as seguintes tabelas:
--
--   ✓ orders                     (fila de pedidos no dashboard + status para cliente)
--   ✓ order_items                (detalhes dos pedidos em tempo real)
--   ✓ sessions                   (alerta de fechamento para cliente)
--   ✓ tables                     (mapa de mesas no dashboard)
--   ✓ close_request_participants (notificação de convite de divisão de conta)
--   ✓ session_participants       (atualização da lista de participantes)
--   ✓ payments                   (progresso de pagamento da mesa)
-- ============================================================
