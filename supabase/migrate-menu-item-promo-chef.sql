-- Preço promocional e destaque "Sugestão do Chef" no banner do cardápio mobile.

alter table public.menu_items
  add column if not exists promo_price numeric(10,2)
    check (promo_price is null or promo_price >= 0);

alter table public.menu_items
  add column if not exists is_chef_pick boolean not null default false;

create index if not exists idx_menu_items_chef_pick
  on public.menu_items (restaurant_id)
  where is_chef_pick = true;
