-- Rollback da 0049 — remove a recusa e devolve accept_membership_invite à
-- versão da 0016 (retorno void, sem lock nem auditoria). Vínculos já aceitos
-- continuam `active`; convites já recusados continuam `revoked`.
drop function if exists decline_membership_invite(uuid);
drop function if exists accept_membership_invite(uuid);

create function accept_membership_invite(p_membership_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_status membership_status;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  select user_id, status into v_user_id, v_status
  from memberships where id = p_membership_id;

  if v_user_id is null then
    raise exception 'Convite não encontrado.';
  end if;
  if v_user_id <> auth.uid() then
    raise exception 'Este convite não pertence a este usuário.';
  end if;
  if v_status <> 'invited' then
    raise exception 'Este convite não está mais pendente.';
  end if;

  update memberships
  set status = 'active', accepted_at = now(), updated_at = now()
  where id = p_membership_id;
end;
$$;
revoke execute on function accept_membership_invite(uuid) from public;
grant execute on function accept_membership_invite(uuid) to authenticated;
