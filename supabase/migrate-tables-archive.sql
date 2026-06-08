-- ============================================================
-- Arquivamento de mesas (soft-delete)
--
-- Mesas que já tiveram pagamento NÃO podem ser excluídas de fato: as tabelas
-- de auditoria/retenção financeira (payment_receipt_snapshots,
-- financial_audit_events) referenciam payments/sessions com ON DELETE RESTRICT
-- para preservar o histórico fiscal. Por isso, ao "excluir" uma mesa com
-- histórico, o sistema a ARQUIVA (some das telas, mas o histórico fica intacto).
-- ============================================================

alter table tables
  add column if not exists archived_at timestamptz;

-- Índice das mesas ativas (não arquivadas) por restaurante.
create index if not exists idx_tables_active
  on tables (restaurant_id)
  where archived_at is null;

notify pgrst, 'reload schema';
