-- ============================================================
-- Mercado Pago OAuth (onboarding por restaurante)
-- Guarda os dados da conexão OAuth além do access token (que continua em
-- payment_gateway_api_key_encrypted). Permite refresh e tokenização no checkout.
-- ============================================================

alter table restaurants
  add column if not exists mp_refresh_token_encrypted text,
  add column if not exists mp_public_key text,
  add column if not exists mp_user_id text,
  add column if not exists mp_token_expires_at timestamptz,
  add column if not exists mp_connected_via text
    check (mp_connected_via is null or mp_connected_via in ('oauth', 'manual'));

comment on column restaurants.mp_refresh_token_encrypted is 'Refresh token OAuth do Mercado Pago (AES-256-GCM).';
comment on column restaurants.mp_public_key is 'Public key da conta MP (tokenização de cartão no checkout).';
comment on column restaurants.mp_connected_via is 'oauth = conectado via OAuth; manual = token colado.';

notify pgrst, 'reload schema';
