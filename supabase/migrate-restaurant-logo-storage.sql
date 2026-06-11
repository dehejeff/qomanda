-- Bucket para logos dos restaurantes (Settings → Enviar logo).
-- Caminho: restaurant-logos/{restaurant_id}/logo.{jpg|png|webp}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-logos',
  'restaurant-logos',
  true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public_read_logo" on storage.objects;
create policy "public_read_logo"
  on storage.objects for select
  using (bucket_id = 'restaurant-logos');

drop policy if exists "owner_upload_logo" on storage.objects;
create policy "owner_upload_logo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'restaurant-logos'
    and split_part(name, '/', 1) in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "owner_update_logo" on storage.objects;
create policy "owner_update_logo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'restaurant-logos'
    and split_part(name, '/', 1) in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'restaurant-logos'
    and split_part(name, '/', 1) in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "owner_delete_logo" on storage.objects;
create policy "owner_delete_logo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'restaurant-logos'
    and split_part(name, '/', 1) in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
