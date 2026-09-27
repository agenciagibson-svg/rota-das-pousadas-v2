-- =============================================================================
-- 0076 — Fotos da pousada pelo próprio dono.
--
-- Até aqui só a equipe da plataforma subia fotos (0037). O dono/gestor da
-- pousada (auth_can_manage_pousada: proprietario ou admin_pousada ativos)
-- passa a enviar e remover fotos, SÓ dentro da pasta da própria pousada:
-- `pousadas/<pousada_id>/<arquivo>`. A foto é pública (o bucket já é), como
-- a vitrine exige.
--
-- Também limita o bucket a imagens de até 10 MB.
-- =============================================================================

-- Pasta do objeto → pousada, sem quebrar com nome fora do padrão (o cast
-- direto para uuid dentro da policy estouraria erro em vez de negar).
create or replace function auth_can_manage_pousada_photo(object_name text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_folder text := split_part(coalesce(object_name, ''), '/', 1);
begin
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return auth_can_manage_pousada(v_folder::uuid);
end;
$$;
revoke execute on function auth_can_manage_pousada_photo(text) from public;
grant execute on function auth_can_manage_pousada_photo(text) to authenticated;

drop policy if exists "pousadas_bucket_owner_insert" on storage.objects;
create policy "pousadas_bucket_owner_insert" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pousadas' and auth_can_manage_pousada_photo(name));

drop policy if exists "pousadas_bucket_owner_delete" on storage.objects;
create policy "pousadas_bucket_owner_delete" on storage.objects for delete
  to authenticated
  using (bucket_id = 'pousadas' and auth_can_manage_pousada_photo(name));

update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
 where id = 'pousadas';
