-- Mercado Pago como gateway de pagamento do restaurante
-- Rode no Supabase SQL Editor após migrate-commercial-restaurant-account.sql

alter table restaurants drop constraint if exists restaurants_payment_gateway_provider_check;

alter table restaurants
  add constraint restaurants_payment_gateway_provider_check
  check (payment_gateway_provider is null or payment_gateway_provider in ('manual', 'asaas', 'mercado_pago'));

comment on column restaurants.payment_gateway_provider is 'manual | asaas | mercado_pago — conta do restaurante';
