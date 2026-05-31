-- Habilita Supabase Realtime para o painel do restaurante (pedidos, pagamentos, mesas).
-- Execute no SQL Editor do Supabase se a atualização automática não funcionar.

do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.payments;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.tables;
exception when duplicate_object then null;
end $$;

-- Filtros Realtime por restaurant_id exigem replica identity full em UPDATE/DELETE
alter table public.orders   replica identity full;
alter table public.payments replica identity full;
alter table public.tables   replica identity full;
