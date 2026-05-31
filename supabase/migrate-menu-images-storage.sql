-- Bucket público para fotos do cardápio.
-- Caminho: menu-images/{restaurant_id}/{filename}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "menu_images_public_read" on storage.objects;
create policy "menu_images_public_read"
  on storage.objects for select
  using (bucket_id = 'menu-images');

drop policy if exists "menu_images_owner_insert" on storage.objects;
create policy "menu_images_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and exists (
      select 1 from public.restaurants r
      where r.owner_id = auth.uid()
        and r.id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "menu_images_owner_update" on storage.objects;
create policy "menu_images_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'menu-images'
    and exists (
      select 1 from public.restaurants r
      where r.owner_id = auth.uid()
        and r.id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "menu_images_owner_delete" on storage.objects;
create policy "menu_images_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and exists (
      select 1 from public.restaurants r
      where r.owner_id = auth.uid()
        and r.id::text = (storage.foldername(name))[1]
    )
  );
