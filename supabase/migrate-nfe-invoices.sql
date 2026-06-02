-- ============================================================
-- NF-e: tipo de nota por restaurante + registros de notas emitidas
-- ============================================================

-- Tipo de nota que o restaurante emite ao consumidor
alter table restaurants
  add column if not exists nfe_note_type text
    check (nfe_note_type is null or nfe_note_type in ('nfce', 'nfse'));

comment on column restaurants.nfe_note_type is 'nfce=Nota Consumidor (modelo 65), nfse=Nota de Serviço';

-- Notas emitidas (1 por pagamento, idealmente)
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
  provider_ref    text,                 -- ref/id idempotente no provedor
  environment     text not null default 'homologacao'
                  check (environment in ('homologacao', 'producao')),
  number          text,
  series          text,
  amount          numeric(10,2) not null default 0,
  danfe_url       text,                 -- PDF da nota (DANFE)
  xml_url         text,
  access_key      text,                 -- chave de acesso (44 dígitos)
  error_message   text,
  whatsapp_sent_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists nfe_invoices_restaurant_idx on nfe_invoices (restaurant_id, created_at desc);
create index if not exists nfe_invoices_payment_idx on nfe_invoices (payment_id);

-- updated_at automático
create or replace function fn_nfe_invoices_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end; $$;

drop trigger if exists trg_nfe_invoices_updated_at on nfe_invoices;
create trigger trg_nfe_invoices_updated_at
before update on nfe_invoices
for each row execute function fn_nfe_invoices_updated_at();

alter table nfe_invoices enable row level security;

-- Dono vê as notas do próprio restaurante
drop policy if exists "owner_all" on nfe_invoices;
create policy "owner_all" on nfe_invoices for all using (
  restaurant_id in (select id from restaurants where owner_id = auth.uid())
);

notify pgrst, 'reload schema';
