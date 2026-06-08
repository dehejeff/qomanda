-- ============================================================
-- Alocação de mesas para um grupo da fila (grupo grande = várias mesas)
--
-- Um grupo grande (ex.: 14 pessoas) não cabe numa mesa só. A equipe "aponta"
-- as mesas (10, 11, 12); cada uma vira `reserved` e fica ligada à entrada da
-- fila por esta tabela. Ao sentar/cancelar/não-vir, as mesas voltam a `free`.
-- Detalhes: docs/modulos/FILA-ESPERA.md
-- ============================================================

-- Reserva direta pelo grid (página Mesas) não está presa a uma característica:
-- a equipe escolhe as mesas diretamente. feature_id passa a aceitar NULL.
alter table table_waitlist alter column feature_id drop not null;

create table if not exists table_waitlist_allocations (
  waitlist_id uuid        not null references table_waitlist(id) on delete cascade,
  table_id    uuid        not null references tables(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (waitlist_id, table_id)
);
create index if not exists idx_twa_table on table_waitlist_allocations(table_id);

alter table table_waitlist_allocations enable row level security;

-- Dono gerencia (via restaurante da entrada da fila). Operações da equipe passam
-- pelas rotas server (service role), como o resto da fila.
do $$ begin
  if not exists (select 1 from pg_policies where tablename='table_waitlist_allocations' and policyname='owner_all') then
    create policy "owner_all" on table_waitlist_allocations for all
      using (waitlist_id in (
        select w.id from table_waitlist w
        join restaurants r on r.id = w.restaurant_id
        where r.owner_id = auth.uid()
      ));
  end if;
end $$;

notify pgrst, 'reload schema';
