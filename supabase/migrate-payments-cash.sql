-- Permite pagamentos em dinheiro (confirmados manualmente pelo restaurante)
alter table payments drop constraint if exists payments_method_check;
alter table payments add constraint payments_method_check
  check (method in ('credit','debit','pix','offer','cash'));
