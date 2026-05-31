-- Migração: hub do cliente — favoritos
-- Rodar no SQL Editor do Supabase

create table if not exists customer_favorites (
  customer_id   uuid        not null references customers(id) on delete cascade,
  restaurant_id uuid        not null references restaurants(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (customer_id, restaurant_id)
);

create index if not exists idx_customer_favorites_customer
  on customer_favorites(customer_id);

alter table customer_favorites enable row level security;

-- Exposto apenas via API com service role (mesmo padrão de customer_visits)
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'customer_favorites' and policyname = 'public_insert'
  ) then
    create policy "public_insert" on customer_favorites for insert with check (true);
  end if;
end $$;
