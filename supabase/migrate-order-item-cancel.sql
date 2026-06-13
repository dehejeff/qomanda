-- Cancelamento de item pelo restaurante (qualidade / acordo com cliente).
-- cancelled_qty: unidades removidas da conta (ex.: 1 de 2 hambúrgueres).
-- cancelled_at: preenchido quando a linha inteira foi removida.

alter table order_items
  add column if not exists cancelled_at timestamptz;

alter table order_items
  add column if not exists cancelled_qty int not null default 0;

alter table order_items drop constraint if exists order_items_cancelled_qty_check;
alter table order_items add constraint order_items_cancelled_qty_check
  check (cancelled_qty >= 0 and cancelled_qty <= quantity);

comment on column order_items.cancelled_at is
  'Preenchido quando todas as unidades da linha saíram da conta.';
comment on column order_items.cancelled_qty is
  'Unidades removidas da conta (parcial ou total). Cobrável = quantity - cancelled_qty.';

-- Linhas já canceladas via cancelled_at (versão anterior)
update order_items
set cancelled_qty = quantity
where cancelled_at is not null and cancelled_qty = 0;
