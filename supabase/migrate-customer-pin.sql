-- PIN opcional de 4 dígitos para login remoto do cliente
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS pin_hash TEXT;

COMMENT ON COLUMN customers.pin_hash IS 'Hash scrypt do PIN de 4 dígitos (salt:hash). NULL = sem PIN.';
