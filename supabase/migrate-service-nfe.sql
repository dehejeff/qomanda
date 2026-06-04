-- ============================================================
-- NF-e de serviço: Qomanda (prestador) → restaurante (tomador)
-- 1 nota por fatura de mensalidade (billing_invoices). Não confundir com
-- nfe_invoices, que é a nota do restaurante → consumidor.
-- ============================================================

create table if not exists service_nfe_invoices (
  id                 uuid primary key default uuid_generate_v4(),
  billing_invoice_id uuid not null references billing_invoices(id) on delete cascade,
  restaurant_id      uuid not null references restaurants(id) on delete cascade,
  status             text not null default 'pending'
                     check (status in ('pending', 'processing', 'issued', 'error', 'simulated', 'cancelled')),
  provider           text,
  provider_ref       text,                 -- ref idempotente no provedor (svc:<billing_invoice_id>)
  environment        text not null default 'homologacao'
                     check (environment in ('homologacao', 'producao')),
  number             text,
  amount             numeric(10,2) not null default 0,
  danfe_url          text,                 -- PDF da nota
  xml_url            text,
  access_key         text,
  error_message      text,
  emailed_at         timestamptz,          -- quando o link foi enviado ao restaurante
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (billing_invoice_id)              -- idempotência: 1 nota por fatura
);

create index if not exists service_nfe_invoices_restaurant_idx
  on service_nfe_invoices (restaurant_id, created_at desc);

comment on table service_nfe_invoices is
  'NFS-e emitida pela Qomanda para o CNPJ do restaurante (mensalidade + taxas).';

create or replace function fn_service_nfe_invoices_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end; $$;

drop trigger if exists trg_service_nfe_invoices_updated_at on service_nfe_invoices;
create trigger trg_service_nfe_invoices_updated_at
before update on service_nfe_invoices
for each row execute function fn_service_nfe_invoices_updated_at();

-- Dado comercial interno — apenas service role (portal interno usa admin client).
alter table service_nfe_invoices enable row level security;

notify pgrst, 'reload schema';
