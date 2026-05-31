-- Token secreto por mesa — obrigatório no check-in (QR Code).
-- URL: /{slug}?mesa={number}&t={check_in_token}

alter table public.tables
  add column if not exists check_in_token uuid not null default gen_random_uuid();

update public.tables
  set check_in_token = gen_random_uuid()
  where check_in_token is null;

create unique index if not exists idx_tables_check_in_token
  on public.tables(check_in_token);
