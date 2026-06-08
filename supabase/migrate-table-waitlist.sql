-- ============================================================
-- Fila de espera por mesa (característica) — schema
--
-- Clientes esperam por uma mesa com determinada característica (vista praia,
-- montanha, varanda…). Ao liberar uma mesa com a tag, o próximo da fila é
-- avisado no app e tem um tempo de tolerância (configurado pelo restaurante).
-- Detalhes: docs/modulos/FILA-ESPERA.md
-- ============================================================

-- Tolerância (minutos) para ocupar a mesa após ser chamado.
alter table restaurants
  add column if not exists waitlist_tolerance_minutes int not null default 10;

-- Características/tags por restaurante (reaproveitáveis).
create table if not exists table_features (
  id            uuid        primary key default uuid_generate_v4(),
  restaurant_id uuid        not null references restaurants(id) on delete cascade,
  name          text        not null,
  emoji         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_table_features_restaurant on table_features(restaurant_id);

-- Quais mesas têm cada característica (N:N).
create table if not exists table_feature_map (
  table_id   uuid not null references tables(id) on delete cascade,
  feature_id uuid not null references table_features(id) on delete cascade,
  primary key (table_id, feature_id)
);
create index if not exists idx_table_feature_map_feature on table_feature_map(feature_id);

-- A fila de espera.
create table if not exists table_waitlist (
  id                uuid        primary key default uuid_generate_v4(),
  restaurant_id     uuid        not null references restaurants(id) on delete cascade,
  feature_id        uuid        not null references table_features(id) on delete cascade,
  customer_id       uuid        references customers(id) on delete set null,
  name              text        not null,
  whatsapp          text,
  party_size        int         not null default 1,
  status            text        not null default 'waiting'
                                check (status in ('waiting','notified','seated','expired','cancelled')),
  source            text        not null default 'customer'
                                check (source in ('customer','staff')),
  notified_table_id uuid        references tables(id) on delete set null,
  notified_at       timestamptz,
  expires_at        timestamptz,
  seated_session_id uuid        references sessions(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- Fila ativa por característica (ordem de chegada).
create index if not exists idx_table_waitlist_active
  on table_waitlist(restaurant_id, feature_id, status, created_at);
create index if not exists idx_table_waitlist_customer
  on table_waitlist(customer_id) where customer_id is not null;

create or replace function fn_table_waitlist_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end; $$;
drop trigger if exists trg_table_waitlist_updated_at on table_waitlist;
create trigger trg_table_waitlist_updated_at
before update on table_waitlist
for each row execute function fn_table_waitlist_updated_at();

-- ── RLS ──
alter table table_features    enable row level security;
alter table table_feature_map enable row level security;
alter table table_waitlist    enable row level security;

-- Características: dono gerencia; leitura pública (cliente vê as tags disponíveis).
do $$ begin
  if not exists (select 1 from pg_policies where tablename='table_features' and policyname='owner_all') then
    create policy "owner_all" on table_features for all
      using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='table_features' and policyname='public_read') then
    create policy "public_read" on table_features for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='table_feature_map' and policyname='owner_all') then
    create policy "owner_all" on table_feature_map for all
      using (table_id in (
        select t.id from tables t join restaurants r on r.id = t.restaurant_id
        where r.owner_id = auth.uid()
      ));
  end if;
  if not exists (select 1 from pg_policies where tablename='table_feature_map' and policyname='public_read') then
    create policy "public_read" on table_feature_map for select using (true);
  end if;
  -- Fila: contém PII (nome/zap). SEM leitura pública — só o dono (admin client
  -- nas rotas server). Operações do cliente passam por rota server (service role).
  if not exists (select 1 from pg_policies where tablename='table_waitlist' and policyname='owner_all') then
    create policy "owner_all" on table_waitlist for all
      using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
  end if;
end $$;

notify pgrst, 'reload schema';
