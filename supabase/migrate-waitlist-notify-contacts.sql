-- Contato secundário na fila + controle de aviso WhatsApp ao chamar a mesa.
alter table table_waitlist
  add column if not exists secondary_name text,
  add column if not exists whatsapp_secondary text,
  add column if not exists whatsapp_notified_at timestamptz;

comment on column table_waitlist.secondary_name is 'Segunda pessoa do grupo (opcional) — também recebe aviso WhatsApp';
comment on column table_waitlist.whatsapp_secondary is 'WhatsApp da segunda pessoa (E.164 dígitos)';
comment on column table_waitlist.whatsapp_notified_at is 'Quando o aviso WhatsApp de mesa pronta foi enfileirado';

notify pgrst, 'reload schema';
