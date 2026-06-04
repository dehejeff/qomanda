-- ============================================================
-- Lembretes de cobrança (e-mail de atraso)
-- last_reminder_at evita reenviar o lembrete mais de uma vez por dia.
-- ============================================================

alter table billing_invoices
  add column if not exists last_reminder_at timestamptz;

comment on column billing_invoices.last_reminder_at is
  'Último envio de lembrete de cobrança (throttle do cron billing-reminders).';

notify pgrst, 'reload schema';
