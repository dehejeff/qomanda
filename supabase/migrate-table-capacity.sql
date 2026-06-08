-- ============================================================
-- Capacidade da mesa (nº de pessoas)
--
-- Usada na fila de espera: ao liberar uma mesa, o sistema só chama da fila
-- quem tem grupo (party_size) que cabe na mesa. NULL = sem restrição.
-- ============================================================

alter table tables
  add column if not exists capacity int check (capacity is null or capacity > 0);

notify pgrst, 'reload schema';
