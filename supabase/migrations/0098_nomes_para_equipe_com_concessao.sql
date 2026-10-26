-- 0098 — 0093 com o acesso da equipe da Rota pelo caminho certo.
--
-- A 0093 liberava as duas funções para membro ativo OU qualquer papel de
-- plataforma (`auth_is_platform_admin()`). A regra do projeto (0047/0083) é
-- que a equipe da Rota só lê dado de pousada com concessão ativa
-- (`auth_has_active_grant`). O teste supabase/tests/security-0083.sql pegou.
-- Mesmo retorno e mesma assinatura: create or replace basta.

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
    and (auth_is_member_of(p_pousada) or auth_has_active_grant(p_pousada));
$$;

revoke execute on function public.pousada_room_names(uuid) from public, anon;
grant execute on function public.pousada_room_names(uuid) to authenticated;

-- Pedidos do app para a Governança, que não lê `bookings` nem `rooms`: sem
-- isto o quadro mostrava "Acomodação · Hóspede" e ninguém sabia para onde
-- levar o pedido. Devolve só o código da reserva, o PRIMEIRO nome do hóspede e
-- o nome do quarto — nada de documento, contato ou valores.
create or replace function public.pousada_order_bookings(p_pousada uuid, p_booking_ids uuid[])
returns table (booking_id uuid, code text, guest_first_name text, room_name text)
language sql
stable
security definer
set search_path = public
as $$
  select b.id,
         b.code,
         nullif(split_part(trim(coalesce(b.guest_name, '')), ' ', 1), ''),
         r.name
  from bookings b
  left join rooms r on r.id = b.room_id
  where b.pousada_id = p_pousada
    and b.id = any (p_booking_ids)
    and (auth_is_member_of(p_pousada) or auth_has_active_grant(p_pousada));
$$;

revoke execute on function public.pousada_order_bookings(uuid, uuid[]) from public, anon;
grant execute on function public.pousada_order_bookings(uuid, uuid[]) to authenticated;
