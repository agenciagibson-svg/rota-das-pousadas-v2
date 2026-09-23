-- =============================================================================
-- 0068 — Nome dos membros na tela de Membros.
--
-- A RLS de `profiles` (0002) só deixa cada usuário ler o próprio perfil. A
-- tela de Membros buscava os nomes direto na tabela, então o dono via o próprio
-- nome e todo o resto da equipe aparecia como "Sem nome".
--
-- Mesmo desenho de `list_membership_emails` (0017): security definer, devolve
-- só o nome dos membros da pousada pedida e só para quem gerencia a pousada
-- (`auth_can_manage_pousada`: proprietário e admin_pousada, os papéis com
-- `member:view`). A RLS de `profiles` segue fechada para o resto.
-- =============================================================================

create or replace function list_membership_names(p_pousada_id uuid)
returns table(user_id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.full_name
  from memberships m
  join profiles p on p.id = m.user_id
  where m.pousada_id = p_pousada_id
    and auth_can_manage_pousada(p_pousada_id);
$$;
revoke execute on function list_membership_names(uuid) from public, anon;
grant execute on function list_membership_names(uuid) to authenticated;
