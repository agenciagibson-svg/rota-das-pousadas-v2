-- Rollback da 0081 (profiles + escrita de catálogo por plataforma).
-- ATENÇÃO: reabre C-1 (autopromoção a platform_role via PATCH direto) e A-1
-- (qualquer platform_role escreve rooms/availability/media/reviews). Use só
-- para destravar uma regressão, e reaplique a 0081 corrigida em seguida.

-- (B) volta as policies de escrita e a guarda de avaliações (0002/0037/0066).
create or replace function guard_review_changes()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth_is_platform_admin() then
    return new;
  end if;

  if new.pousada_id is distinct from old.pousada_id or new.booking_id is distinct from old.booking_id
     or new.author_id is distinct from old.author_id or new.created_at is distinct from old.created_at then
    raise exception 'A avaliação não pode mudar de pousada, reserva, autor ou data.';
  end if;

  if old.author_id = auth.uid() then
    if new.response is distinct from old.response then
      raise exception 'Só a pousada responde à avaliação.';
    end if;
  elsif new.rating is distinct from old.rating or new.text is distinct from old.text then
    raise exception 'A pousada só pode responder à avaliação, não alterar a nota ou o comentário do hóspede.';
  end if;
  return new;
end;
$$;

drop policy if exists "pousadas_bucket_admin_write" on storage.objects;
create policy "pousadas_bucket_admin_write" on storage.objects for insert
  with check (bucket_id = 'pousadas' and auth_is_platform_admin());

drop policy if exists "reviews_update" on reviews;
create policy "reviews_update" on reviews for update
  using (author_id = auth.uid() or auth_can_manage_pousada(pousada_id) or auth_is_platform_admin())
  with check (author_id = auth.uid() or auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());

drop policy if exists "pousada_amen_write" on pousada_amenities;
create policy "pousada_amen_write" on pousada_amenities for all
  using (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin())
  with check (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());

drop policy if exists "pousada_exp_write" on pousada_experiences;
create policy "pousada_exp_write" on pousada_experiences for all
  using (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin())
  with check (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());

drop policy if exists "availability_write" on availability;
create policy "availability_write" on availability for all
  using (exists (select 1 from rooms r where r.id = availability.room_id
                 and (auth_can_manage_pousada(r.pousada_id) or auth_is_platform_admin())))
  with check (exists (select 1 from rooms r where r.id = availability.room_id
                 and (auth_can_manage_pousada(r.pousada_id) or auth_is_platform_admin())));

drop policy if exists "media_write" on media;
create policy "media_write" on media for all
  using (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin())
  with check (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());

drop policy if exists "rooms_write" on rooms;
create policy "rooms_write" on rooms for all
  using (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin())
  with check (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());

-- (A) profiles: remove a guarda e devolve os grants de tabela (estado da 0054).
drop trigger if exists trg_guard_profile_platform_role on public.profiles;
drop function if exists guard_profile_platform_role();
grant insert, update on public.profiles to anon, authenticated;
revoke update (platform_role) on public.profiles from authenticated, anon;
revoke insert (platform_role) on public.profiles from authenticated, anon;
comment on column public.profiles.platform_role is
  'Somente via RPC set_platform_role_by_email (0054, master-only). Coluna revogada de insert/update direto de authenticated/anon -- ver 0054 para o achado (autopromocao via PATCH direto).';
