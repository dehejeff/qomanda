-- Bucket para logos dos restaurantes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-logos',
  'restaurant-logos',
  true,
  2097152, -- 2 MB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Dono do restaurante pode fazer upload/update na pasta do próprio restaurante
create policy "owner_upload_logo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'restaurant-logos'
    and (storage.foldername(name))[1] in (
      select id::text from restaurants where owner_id = auth.uid()
    )
  );

create policy "owner_update_logo" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'restaurant-logos'
    and (storage.foldername(name))[1] in (
      select id::text from restaurants where owner_id = auth.uid()
    )
  );

-- Leitura pública (logos são exibidas para clientes)
create policy "public_read_logo" on storage.objects
  for select using (bucket_id = 'restaurant-logos');
