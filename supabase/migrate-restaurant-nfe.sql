-- Configuração de NF-e por restaurante (portal interno Qomanda)

alter table restaurants
  add column if not exists nfe_enabled              boolean not null default false,
  add column if not exists nfe_status               text not null default 'disabled'
    check (nfe_status in ('disabled', 'pending', 'active', 'error')),
  add column if not exists nfe_provider             text
    check (nfe_provider is null or nfe_provider in ('focusnfe', 'nfe_io', 'nota_simples', 'tecnospeed', 'other')),
  add column if not exists nfe_environment          text not null default 'homologacao'
    check (nfe_environment in ('homologacao', 'producao')),
  add column if not exists nfe_provider_token_encrypted text,
  add column if not exists nfe_provider_company_id  text,
  add column if not exists nfe_state_registration   text,
  add column if not exists nfe_municipal_registration text,
  add column if not exists nfe_tax_regime           text
    check (nfe_tax_regime is null or nfe_tax_regime in (
      'mei', 'simples_nacional', 'simples_excesso', 'lucro_presumido', 'lucro_real'
    )),
  add column if not exists nfe_cnae                 text,
  add column if not exists nfe_invoice_series       text default '1',
  add column if not exists nfe_next_invoice_number  int,
  add column if not exists nfe_auto_emit            boolean not null default false,
  add column if not exists nfe_split_food_drinks    boolean not null default true,
  add column if not exists nfe_notes                text,
  add column if not exists nfe_configured_at        timestamptz;

comment on column restaurants.nfe_provider_token_encrypted is 'Token API do emissor — criptografado';
comment on column restaurants.nfe_split_food_drinks is 'Emitir NF-e separada: alimentação vs bebidas alcoólicas';

notify pgrst, 'reload schema';
