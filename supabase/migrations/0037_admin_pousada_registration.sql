-- =============================================================================
-- Cadastro rápido de pousada pelo admin (equipe da plataforma), usando o
-- Instagram da pousada como referência manual. Não exige RPC nova nem
-- mudança de RLS em `pousadas`/`rooms`: a policy "pousadas_insert" (0002)
-- já libera insert para `auth_is_platform_admin()`, e "rooms_write" também.
--
-- Falta apenas: campo para o link do Instagram e um bucket de Storage para
-- as fotos (nenhum bucket existe ainda neste projeto).
-- =============================================================================

alter table pousadas add column if not exists instagram text not null default '';

-- Bucket público (leitura livre, como já é o caso de `image`/`gallery` hoje).
insert into storage.buckets (id, name, public)
values ('pousadas', 'pousadas', true)
on conflict (id) do nothing;

-- Só a equipe da plataforma sobe fotos por enquanto (cadastro é feito pelo
-- admin). Upload pelo próprio proprietário fica para uma etapa futura.
create policy "pousadas_bucket_admin_write" on storage.objects for insert
  with check (bucket_id = 'pousadas' and auth_is_platform_admin());
