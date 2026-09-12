-- =============================================================================
-- Storage policies for the "media" bucket (product photos, video thumbnails
-- uploaded directly from the admin panel). Run this once in the Supabase SQL
-- Editor, same as schema.sql. The bucket itself was already created via the
-- Storage API and is public (readable by anyone with the URL, no policy
-- needed for that) - these policies only govern who can upload/replace/delete.
-- =============================================================================

create policy "media_admin_insert" on storage.objects for insert
    with check (bucket_id = 'media' and auth.role() = 'authenticated');

create policy "media_admin_update" on storage.objects for update
    using (bucket_id = 'media' and auth.role() = 'authenticated')
    with check (bucket_id = 'media' and auth.role() = 'authenticated');

create policy "media_admin_delete" on storage.objects for delete
    using (bucket_id = 'media' and auth.role() = 'authenticated');
