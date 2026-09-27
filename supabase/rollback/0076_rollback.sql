-- Rollback de 0076_owner_photos.sql
drop policy if exists "pousadas_bucket_owner_insert" on storage.objects;
drop policy if exists "pousadas_bucket_owner_delete" on storage.objects;
drop function if exists auth_can_manage_pousada_photo(text);
update storage.buckets set file_size_limit = null, allowed_mime_types = null where id = 'pousadas';
