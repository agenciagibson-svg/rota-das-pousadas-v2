-- 0093 — Nome do quarto para toda a equipe da pousada.
--
-- O Financeiro (e a Governança) não leem a tabela `rooms` (0026/0085: a
-- leitura traz diária, notas comerciais e visibilidade). Por isso a lista e o
-- detail da reserva mostravam só "Acomodação" para o Financeiro.
--
-- Esta função devolve SÓ id e nome dos quartos da pousada, para membro ativo
-- (ou admin da plataforma). Não abre preço, descrição nem status comercial.

create or replace function public.pousada_room_names(p_pousada uuid)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.name
  from rooms r
  where r.pousada_id = p_pousada
    and (auth_is_member_of(p_pousada) or auth_is_platform_admin());
$$;

revoke execute on function public.pousada_room_names(uuid) from public, anon;
grant execute on function public.pousada_room_names(uuid) to authenticated;
