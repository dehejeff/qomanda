-- ============================================================
-- Papel "recepcionista" (e regularização do "caixa")
--
-- A constraint original de restaurant_members.role só listava
-- owner/waiter/kitchen/manager — sem 'caixa' (já usado na app) nem
-- 'recepcionista' (novo). Aqui reabrimos o check com a lista completa.
--
-- Recepcionista: opera a FILA DE ESPERA (incluir walk-in, ver quem espera,
-- chamar próximo, sentou/não-veio) e vê o status das mesas. Acesso em /garcom
-- (cai direto na aba Fila). NÃO acessa pedidos, pagamentos nem o painel.
-- ============================================================

alter table restaurant_members
  drop constraint if exists restaurant_members_role_check;

alter table restaurant_members
  add constraint restaurant_members_role_check
  check (role in ('owner', 'waiter', 'kitchen', 'manager', 'caixa', 'recepcionista'));

notify pgrst, 'reload schema';
