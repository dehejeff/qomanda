-- ============================================================
-- Fila de jobs assíncronos
-- Desacopla efeitos externos lentos (emissão de NF-e + WhatsApp) do request
-- de pagamento. O worker (/api/cron/process-jobs) consome a fila com retry.
-- ============================================================

create table if not exists async_jobs (
  id            uuid primary key default uuid_generate_v4(),
  type          text not null,                 -- ex.: 'nfe_emit'
  payload       jsonb not null default '{}',
  status        text not null default 'pending'
                check (status in ('pending', 'processing', 'done', 'error')),
  attempts      int not null default 0,
  max_attempts  int not null default 5,
  run_after     timestamptz not null default now(),  -- backoff: só roda após este instante
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Índice para buscar jobs prontos (pendentes e vencidos) rapidamente.
create index if not exists async_jobs_due_idx
  on async_jobs (run_after)
  where status = 'pending';

comment on table async_jobs is
  'Fila de jobs assíncronos (NF-e, WhatsApp, etc.) consumida pelo cron process-jobs.';

create or replace function fn_async_jobs_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end; $$;

drop trigger if exists trg_async_jobs_updated_at on async_jobs;
create trigger trg_async_jobs_updated_at
before update on async_jobs
for each row execute function fn_async_jobs_updated_at();

-- Apenas service role (enfileira/consome server-side com admin client).
alter table async_jobs enable row level security;

notify pgrst, 'reload schema';
