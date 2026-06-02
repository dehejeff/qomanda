-- ============================================================
-- Cobrança automática da mensalidade (SaaS): Asaas charge por fatura
-- ============================================================

-- Cliente Asaas do restaurante na conta MASTER da Qomanda (para cobrar mensalidade)
alter table restaurants
  add column if not exists asaas_billing_customer_id text;

comment on column restaurants.asaas_billing_customer_id is 'ID do restaurante como CLIENTE da conta master Qomanda no Asaas (cobrança da mensalidade).';

-- Faturas: vínculo com a cobrança Asaas + link de pagamento
alter table billing_invoices
  add column if not exists asaas_payment_id text,
  add column if not exists charge_method text
    check (charge_method is null or charge_method in ('pix', 'boleto', 'credit_card')),
  add column if not exists invoice_url text,          -- link/copia-e-cola PIX ou boleto
  add column if not exists period_year int,
  add column if not exists period_month int;

-- Idempotência: 1 fatura por restaurante por período (mês)
create unique index if not exists billing_invoices_period_unique
  on billing_invoices (restaurant_id, period_start);

create index if not exists billing_invoices_asaas_payment_idx
  on billing_invoices (asaas_payment_id);

notify pgrst, 'reload schema';
