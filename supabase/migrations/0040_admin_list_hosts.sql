-- =============================================================================
-- Painel admin — visão consolidada de anfitriões (donos de pousada) em toda a
-- plataforma. E-mail só existe em auth.users, não em profiles — mesmo padrão
-- de list_membership_emails (0017), mas plataforma-wide em vez de por
-- pousada, e filtrado por auth_is_platform_admin() no próprio WHERE em vez de
-- lançar exceção (quem não é staff só recebe um conjunto vazio).
-- =============================================================================
create or replace function list_platform_hosts()
returns table(
  user_id uuid,
  full_name text,
  email text,
  pousada_id uuid,
  pousada_name text,
  pousada_slug text,
  role user_role,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.full_name, u.email, m.pousada_id, ps.name, ps.slug, m.role, m.created_at
  from memberships m
  join profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  join pousadas ps on ps.id = m.pousada_id
  where m.role = 'proprietario'
    and m.status = 'active'
    and auth_is_platform_admin()
  order by m.created_at desc;
$$;

revoke execute on function list_platform_hosts() from public;
grant execute on function list_platform_hosts() to authenticated;
