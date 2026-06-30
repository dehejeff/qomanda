-- CRM de leads comerciais da Qomanda
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp text not null,
  email text,
  restaurant_name text not null,
  restaurant_type text not null
    check (restaurant_type in ('salao','balcao','salao_balcao','food_hall')),
  status text not null default 'novo'
    check (status in ('novo','contato_feito','demo_agendada','proposta_enviada','negociacao','fechado_ganho','fechado_perdido')),
  notes text,
  source text not null default 'qr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_status_created_idx on leads (status, created_at desc);
create index if not exists leads_created_idx on leads (created_at desc);

-- Sem RLS policies públicas: acesso apenas via service-role (admin client)
alter table leads enable row level security;

notify pgrst, 'reload schema';
