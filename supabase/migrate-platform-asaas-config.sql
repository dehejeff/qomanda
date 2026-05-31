-- Configuração global do gateway de pagamentos (conta master Qomanda / Asaas)
-- Acessível apenas via service role (portal interno).

create table if not exists platform_asaas_config (
  id                      smallint primary key default 1 check (id = 1),
  environment             text not null default 'sandbox'
                          check (environment in ('sandbox', 'production')),
  api_key_encrypted       text,
  webhook_token_encrypted text,
  payment_bypass          boolean not null default false,
  updated_at              timestamptz not null default now(),
  updated_by              uuid references auth.users(id) on delete set null
);

insert into platform_asaas_config (id) values (1) on conflict (id) do nothing;

alter table platform_asaas_config enable row level security;

comment on table platform_asaas_config is 'Credenciais da conta master Asaas — portal interno Qomanda';

notify pgrst, 'reload schema';
