-- Permite entradas na fila sem seção específica (cliente sem preferência ou
-- mesas que não têm nenhuma característica cadastrada no table_feature_map).
alter table table_waitlist alter column feature_id drop not null;
