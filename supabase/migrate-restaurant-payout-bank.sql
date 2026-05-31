-- Conta bancária de repasse (visível ao restaurante — estilo iFood)
alter table restaurants
  add column if not exists payout_holder_name    text,
  add column if not exists payout_document       text,
  add column if not exists bank_code             text,
  add column if not exists bank_name             text,
  add column if not exists bank_agency           text,
  add column if not exists bank_account          text,
  add column if not exists bank_account_digit    text,
  add column if not exists bank_account_type     text
    check (bank_account_type is null or bank_account_type in ('checking', 'savings')),
  add column if not exists payout_configured_at  timestamptz;

comment on column restaurants.payout_document is 'CPF ou CNPJ do titular — deve coincidir com o cadastro da loja';
comment on column restaurants.bank_account is 'Conta bancária de destino dos repasses Qomanda Pay';

notify pgrst, 'reload schema';
