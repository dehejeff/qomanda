-- Corrige políticas RLS do bucket menu-images (upload direto pelo cliente Supabase).
-- Se preferir, o upload também funciona via POST /api/dashboard/menu-image (service role).

drop policy if exists "menu_images_public_read" on storage.objects;
create policy "menu_images_public_read"
  on storage.objects for select
  using (bucket_id = 'menu-images');

drop policy if exists "menu_images_owner_insert" on storage.objects;
create policy "menu_images_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and split_part(name, '/', 1) in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "menu_images_owner_update" on storage.objects;
create policy "menu_images_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'menu-images'
    and split_part(name, '/', 1) in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'menu-images'
    and split_part(name, '/', 1) in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "menu_images_owner_delete" on storage.objects;
create policy "menu_images_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and split_part(name, '/', 1) in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );
