-- =============================================================================
-- Onboarding — RPC atômica para cadastro de pousada pelo proprietário.
-- Cria pousada (status em_analise), acomodação padrão e vínculo (membership)
-- numa única transação. SECURITY DEFINER resolve o "ovo-galinha" da RLS:
-- o usuário ainda não é membro, então não poderia inserir a própria membership.
-- owner_id/user_id vêm de auth.uid() (nunca do cliente).
-- =============================================================================

create or replace function create_pousada(
  p_name text,
  p_city text,
  p_state text,
  p_description text,
  p_price integer,
  p_slug text
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_pousada uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  insert into pousadas (slug, name, city, state, description, price_per_night, image, status, owner_id)
  values (p_slug, p_name, p_city, upper(p_state), p_description, p_price, '/placeholder.svg', 'em_analise', auth.uid())
  returning id into v_pousada;

  insert into rooms (pousada_id, name, capacity, size, base_price, description)
  values (v_pousada, 'Acomodação principal', 4, '—', p_price, 'Acomodação padrão da pousada.');

  insert into memberships (user_id, pousada_id, role)
  values (auth.uid(), v_pousada, 'proprietario');

  return p_slug;
end;
$$;

-- Permite que usuários autenticados chamem a função.
grant execute on function create_pousada(text, text, text, text, integer, text) to authenticated;
