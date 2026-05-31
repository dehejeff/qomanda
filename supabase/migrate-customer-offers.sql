-- ============================================================
-- MIGRAÇÃO: Ofertas direcionadas a clientes (win-back / fidelidade)
--
-- customer_offers: benefício enviado a um cliente específico que pode
-- ser resgatado no checkout quando ele voltar.
--
-- O desconto é absorvido pelo restaurante e registrado como um pagamento
-- de método 'offer' na sessão, de modo que toda a lógica de saldo e
-- liquidação (computeOpenBalance / closeSessionIfSettled) continua válida.
-- ============================================================

create table if not exists customer_offers (
  id                  uuid        primary key default uuid_generate_v4(),
  restaurant_id       uuid        not null references restaurants(id) on delete cascade,
  customer_id         uuid        not null references customers(id) on delete cascade,
  benefit_type        text        not null
                                  check (benefit_type in ('discount_pct','discount_fixed','free_item','custom')),
  benefit_value       text        not null,   -- "10" (pct), "20.00" (R$ fixo) ou descrição (free_item/custom)
  label               text        not null,   -- descrição legível exibida ao cliente
  status              text        not null default 'active'
                                  check (status in ('active','redeemed','expired','cancelled')),
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  redeemed_at         timestamptz,
  redeemed_session_id uuid        references sessions(id) on delete set null
);

-- Origem da oferta: null = cortesia (manual); preenchido = conquistada por regra de fidelidade
alter table customer_offers
  add column if not exists source_rule_id uuid references loyalty_rules(id) on delete set null;

create index if not exists idx_customer_offers_lookup
  on customer_offers(customer_id, restaurant_id, status);

alter table customer_offers enable row level security;

-- Dono gerencia as ofertas do seu restaurante (criação no painel)
create policy "owner_all" on customer_offers for all
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Cliente (sem auth) lê as ofertas para exibir no checkout
create policy "public_select" on customer_offers for select using (true);

-- Cliente resgata a oferta (marca como redeemed) — mesmo modelo público dos pagamentos
create policy "public_redeem" on customer_offers for update using (true);

-- Permitir método 'offer' nos pagamentos: crédito do desconto absorvido pelo restaurante
alter table payments drop constraint if exists payments_method_check;
alter table payments add constraint payments_method_check
  check (method in ('credit','debit','pix','offer'));
