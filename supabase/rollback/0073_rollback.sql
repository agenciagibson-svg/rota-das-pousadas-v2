-- Rollback da 0073: volta ensure_traveler_guest ao corpo da 0047 e remove o cadastro do viajante.
create or replace function ensure_traveler_guest(
  p_pousada_id uuid,
  p_full_name text,
  p_email text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_name text := left(trim(coalesce(p_full_name, '')), 150);
  v_email text := nullif(left(lower(trim(coalesce(p_email, ''))), 200), '');
begin
  if auth.uid() is null then raise exception 'Faça login para concluir a reserva.'; end if;
  if length(v_name) < 2 then raise exception 'Informe seu nome completo.'; end if;
  if not exists (
    select 1 from pousadas p
    where p.id = p_pousada_id and p.status = 'publicada'
      and p.tenant_status in ('onboarding', 'active')
  ) then
    raise exception 'Esta pousada não está disponível para reserva.';
  end if;

  -- Só o cadastro do próprio usuário nesta pousada. Nunca casa por e-mail.
  select id into v_id from guests
  where pousada_id = p_pousada_id and user_id = auth.uid()
  order by created_at limit 1;

  if v_id is null then
    insert into guests (pousada_id, user_id, full_name, email, source, created_by)
    values (p_pousada_id, auth.uid(), v_name, v_email, 'public_booking', auth.uid())
    returning id into v_id;

    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'guest.created', 'guests', v_id,
            jsonb_build_object('pousadaId', p_pousada_id, 'source', 'public_booking'));
  else
    update guests
      set full_name = v_name,
          email = coalesce(v_email, email),
          updated_at = now()
      where id = v_id;
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;
revoke all on function ensure_traveler_guest(uuid, text, text) from public, anon;
grant execute on function ensure_traveler_guest(uuid, text, text) to authenticated;

drop table if exists traveler_profiles;
