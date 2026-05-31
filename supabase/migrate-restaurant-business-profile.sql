-- Perfil comercial / jurídico do restaurante (cadastro interno Qomanda)

alter table restaurants
  add column if not exists business_type            text,
  add column if not exists legal_name               text,
  add column if not exists document_type            text
    check (document_type is null or document_type in ('cpf', 'cnpj')),
  add column if not exists document_number          text,
  add column if not exists company_type             text
    check (company_type is null or company_type in ('MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION')),
  add column if not exists owner_cpf                text,
  add column if not exists contact_email            text,
  add column if not exists address_postal_code      text,
  add column if not exists address_street           text,
  add column if not exists address_number           text,
  add column if not exists address_complement       text,
  add column if not exists address_neighborhood     text,
  add column if not exists address_city             text,
  add column if not exists address_state            text,
  add column if not exists estimated_monthly_revenue numeric(12,2);

comment on column restaurants.legal_name is 'Razão social ou nome completo do titular (MEI/CPF)';
comment on column restaurants.document_number is 'CPF ou CNPJ — somente dígitos';
comment on column restaurants.owner_cpf is 'CPF do responsável legal quando document_type = cnpj';

notify pgrst, 'reload schema';
