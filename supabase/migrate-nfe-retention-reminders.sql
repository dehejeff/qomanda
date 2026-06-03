-- Lembretes de retenção de NF-e (20, 15 e 5 dias antes da exclusão)
-- Notificações in-app + log de e-mails enviados

create table if not exists restaurant_notifications (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references restaurants(id) on delete cascade,
  type            text not null check (type in ('nfe_retention')),
  title           text not null,
  body            text not null,
  link            text,
  severity        text not null default 'warning'
                  check (severity in ('info', 'warning', 'critical')),
  metadata        jsonb not null default '{}'::jsonb,
  read_at         timestamptz,
  dismissed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists restaurant_notifications_restaurant_unread_idx
  on restaurant_notifications (restaurant_id, created_at desc)
  where read_at is null and dismissed_at is null;

comment on table restaurant_notifications is
  'Alertas no painel do restaurante (retenção NF-e, etc.)';

create table if not exists nfe_retention_reminder_log (
  id                uuid primary key default uuid_generate_v4(),
  restaurant_id     uuid not null references restaurants(id) on delete cascade,
  days_before       int not null check (days_before in (20, 15, 5)),
  scheduled_for     date not null,
  nfe_count         int not null default 0,
  purge_on          date not null,
  notification_id   uuid references restaurant_notifications(id) on delete set null,
  email_sent        boolean not null default false,
  email_to          text,
  email_error       text,
  created_at        timestamptz not null default now(),
  unique (restaurant_id, days_before, scheduled_for)
);

create index if not exists nfe_retention_reminder_log_restaurant_idx
  on nfe_retention_reminder_log (restaurant_id, created_at desc);

comment on table nfe_retention_reminder_log is
  'Evita reenvio de lembretes 20/15/5 dias antes da exclusão de NF-e';

alter table restaurant_notifications enable row level security;
alter table nfe_retention_reminder_log enable row level security;

notify pgrst, 'reload schema';
