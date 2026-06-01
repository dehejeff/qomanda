-- Data de nascimento do responsável legal / titular (CPF)
-- Necessário para criação de subconta Asaas quando cpfCnpj é CPF (Pessoa Física)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS owner_birth_date date;
