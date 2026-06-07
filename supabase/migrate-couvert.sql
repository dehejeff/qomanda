-- ============================================================
-- Couvert (entrada) + Couvert artístico (música ao vivo)
--
-- Regras de negócio:
--  - Couvert é cobrado POR PESSOA.
--  - NÃO entra na base da taxa de serviço (10%) — derivado de couvert_kind.
--  - CONTA no GMV/comissão e na NF-e (é receita do restaurante) — automático,
--    pois couvert é modelado como order_item → payment.
--  - Couvert tradicional: SÓ MESA (não aparece no balcão).
--  - Couvert artístico: automático por DIAS DA SEMANA + horário (fuso BR).
--
-- Esta migração só adiciona colunas/flags (idempotente). A criação do item de
-- sistema (menu_items.couvert_kind) por restaurante é feita pelo app ao salvar
-- a configuração de couvert nos Settings.
-- ============================================================

-- 1) Configuração no restaurante ----------------------------------------------
alter table restaurants
  add column if not exists couvert_enabled            boolean not null default false,
  add column if not exists couvert_price              numeric(10,2),
  add column if not exists couvert_label              text not null default 'Couvert',
  add column if not exists couvert_artistico_enabled  boolean not null default false,
  add column if not exists couvert_artistico_price    numeric(10,2),
  add column if not exists couvert_artistico_label    text,
  -- Dias da semana com música ao vivo (0=Dom … 6=Sáb, fuso BR). Vazio = nenhum.
  add column if not exists couvert_artistico_days     smallint[] not null default '{}',
  add column if not exists couvert_artistico_start_time time,
  -- Opcional: fim da janela do couvert artístico. Vazio = vale até o fim do dia.
  add column if not exists couvert_artistico_end_time time;

comment on column restaurants.couvert_artistico_days is
  'Dias da semana com couvert artístico (0=Dom … 6=Sáb, fuso BR).';

-- 2) Marca itens de cardápio de couvert ---------------------------------------
-- 'none' = item normal · 'couvert' = entrada · 'artistico' = música ao vivo.
alter table menu_items
  add column if not exists couvert_kind text not null default 'none';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_items_couvert_kind_check') then
    alter table menu_items
      add constraint menu_items_couvert_kind_check
      check (couvert_kind in ('none','couvert','artistico'));
  end if;
end $$;

-- Busca rápida dos itens de couvert de um restaurante (e exclusão da taxa/KDS).
create index if not exists idx_menu_items_couvert
  on menu_items (restaurant_id, couvert_kind)
  where couvert_kind <> 'none';

notify pgrst, 'reload schema';
