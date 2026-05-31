-- ============================================================
-- MIGRAÇÃO: Marketplace Asaas (split por restaurante)
--
-- Modelo: a conta MASTER da Qomanda cria a cobrança e faz o split,
-- enviando a parte do restaurante para a subconta dele (walletId).
-- A taxa da Qomanda fica na conta master (parte não enviada no split).
--
-- A taxa é POR RESTAURANTE (plano): platform_fee_percent + platform_fee_fixed.
-- ============================================================

alter table restaurants
  -- Identificadores da subconta Asaas do restaurante
  add column if not exists asaas_account_id      text,
  add column if not exists asaas_wallet_id       text,
  add column if not exists asaas_onboarding_status text not null default 'pending'
      check (asaas_onboarding_status in ('pending','submitted','approved','rejected')),

  -- Taxa da Qomanda por transação (plano do restaurante)
  add column if not exists platform_fee_percent  numeric(5,2)  not null default 0,
  add column if not exists platform_fee_fixed    numeric(10,2) not null default 0;

comment on column restaurants.asaas_wallet_id is 'walletId da subconta Asaas — destino do split';
comment on column restaurants.platform_fee_percent is 'Percentual retido pela Qomanda por transação';
comment on column restaurants.platform_fee_fixed is 'Valor fixo (R$) retido pela Qomanda por transação';

notify pgrst, 'reload schema';
