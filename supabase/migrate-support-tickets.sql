-- ============================================================
-- Suporte — tickets, mensagens e anexos
-- ============================================================

create table if not exists support_tickets (
  id                uuid primary key default uuid_generate_v4(),
  restaurant_id     uuid not null references restaurants(id) on delete cascade,
  subject           text not null,
  category          text not null default 'other'
                    check (category in ('bug', 'billing', 'payments', 'nfe', 'account', 'feature', 'other')),
  status            text not null default 'open'
                    check (status in ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  priority          text not null default 'normal'
                    check (priority in ('low', 'normal', 'high', 'urgent')),
  created_by        uuid references auth.users(id) on delete set null,
  created_by_email  text,
  created_by_name   text,
  assigned_staff_id uuid references staff_users(id) on delete set null,
  last_message_at   timestamptz not null default now(),
  closed_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists support_tickets_restaurant_idx
  on support_tickets (restaurant_id, last_message_at desc);

create index if not exists support_tickets_status_idx
  on support_tickets (status, last_message_at desc);

create table if not exists support_ticket_messages (
  id              uuid primary key default uuid_generate_v4(),
  ticket_id       uuid not null references support_tickets(id) on delete cascade,
  author_type     text not null check (author_type in ('restaurant', 'staff')),
  author_user_id  uuid references auth.users(id) on delete set null,
  author_name     text,
  author_email    text,
  body            text not null,
  created_at      timestamptz not null default now()
);

create index if not exists support_ticket_messages_ticket_idx
  on support_ticket_messages (ticket_id, created_at asc);

create table if not exists support_ticket_attachments (
  id              uuid primary key default uuid_generate_v4(),
  ticket_id       uuid not null references support_tickets(id) on delete cascade,
  message_id      uuid references support_ticket_messages(id) on delete cascade,
  file_name       text not null,
  file_path       text not null,
  file_size       int not null check (file_size > 0),
  content_type    text not null,
  uploaded_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists support_ticket_attachments_ticket_idx
  on support_ticket_attachments (ticket_id, created_at asc);

-- Bucket privado para anexos de suporte
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table support_tickets enable row level security;
alter table support_ticket_messages enable row level security;
alter table support_ticket_attachments enable row level security;

notify pgrst, 'reload schema';
