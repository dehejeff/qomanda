-- Pagamento manual: PIX / conta bancária do restaurante (sem Asaas)
alter table restaurants
  add column if not exists manual_pix_key text,
  add column if not exists manual_pix_key_type text
    check (manual_pix_key_type is null or manual_pix_key_type in ('cpf', 'cnpj', 'email', 'phone', 'random')),
  add column if not exists manual_payment_holder_name text,
  add column if not exists manual_payment_notes text,
  add column if not exists manual_payment_configured_at timestamptz;

comment on column restaurants.manual_pix_key is 'Chave PIX do restaurante (pagamento manual, 100% na conta do restaurante)';
comment on column restaurants.manual_payment_notes is 'Instruções extras exibidas ao cliente no checkout';

notify pgrst, 'reload schema';
