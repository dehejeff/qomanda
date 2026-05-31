-- ============================================================
-- Setup completo: tokens de check-in + mesa de teste (Mesa 1)
-- Rode este arquivo INTEIRO no SQL Editor do Supabase.
-- ============================================================
-- URL de teste:
--   /tasca-do-porto?mesa=1&t=00000001-0000-4000-8000-000000000001
-- ============================================================

-- 1) Criar coluna check_in_token (se ainda não existir)
alter table public.tables
  add column if not exists check_in_token uuid not null default gen_random_uuid();

update public.tables
  set check_in_token = gen_random_uuid()
  where check_in_token is null;

create unique index if not exists idx_tables_check_in_token
  on public.tables(check_in_token);

-- 2) Token fixo na Mesa 1 da Tasca do Porto (só para testes)
update public.tables t
set check_in_token = '00000001-0000-4000-8000-000000000001'::uuid
from public.restaurants r
where t.restaurant_id = r.id
  and r.slug = 'tasca-do-porto'
  and t.number = '1';

-- 3) Conferir
select r.slug, t.number, t.check_in_token, t.status
from public.tables t
join public.restaurants r on r.id = t.restaurant_id
where r.slug = 'tasca-do-porto' and t.number = '1';
