-- ============================================================
-- Idempotência de webhooks (Asaas / Mercado Pago)
-- Deduplica entregas repetidas do mesmo evento e registra erros.
-- ============================================================

create table if not exists webhook_events (
  id            uuid primary key default uuid_generate_v4(),
  provider      text not null check (provider in ('asaas', 'mercado_pago', 'stripe')),
  event_id      text not null,            -- chave de dedupe (provider-específica)
  event_type    text,
  status        text not null default 'processing'
                check (status in ('processing', 'processed', 'error', 'ignored')),
  attempts      int not null default 1,
  error_message text,
  payload       jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (provider, event_id)
);

create index if not exists webhook_events_provider_created_idx
  on webhook_events (provider, created_at desc);

comment on table webhook_events is
  'Log idempotente de webhooks — evita reprocessar a mesma entrega (provider, event_id).';

create or replace function fn_webhook_events_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end; $$;

drop trigger if exists trg_webhook_events_updated_at on webhook_events;
create trigger trg_webhook_events_updated_at
before update on webhook_events
for each row execute function fn_webhook_events_updated_at();

-- Apenas service role (webhooks rodam server-side com admin client)
alter table webhook_events enable row level security;

notify pgrst, 'reload schema';
