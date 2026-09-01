-- =============================================================================
-- Ciclo 3B — unificação da disponibilidade + fechamento de leitura de `rooms`.
--
-- (A) `availability` (0001): auditada — 0 linhas no banco real, nenhum dado a
-- migrar. Usada hoje só por management.repository.ts (blockDate/unblockDate/
-- listBlockedDates), sempre sobre UM ÚNICO quarto por pousada (o mais barato,
-- via ManagedPousada.roomId) — nunca foi "a pousada inteira" nem
-- multi-acomodação; é limitação da UI do calendário legado, não recriada
-- aqui. A partir desta migration, esses fluxos passam a gravar em
-- `room_blocks` (fonte canônica única) via as mesmas RPCs do inventário —
-- `availability` para de receber escrita da aplicação. A tabela NÃO é
-- removida (sem dado para perder, mas também sem necessidade de dropar
-- schema) — só marcada como legada via COMMENT.
--
-- (B) `rooms_read`: Governança e Financeiro liam a linha INTEIRA de `rooms`
-- (base_price incluso) via `auth_is_member_of` — nem um nem outro tem ação
-- de estrutura/preço na matriz RBAC. Fechado com um novo helper mais
-- estrito para a policy de tabela + uma RPC de projeção mínima para
-- Governança (não há RLS por coluna no Postgres).
-- =============================================================================

comment on table availability is
  'LEGADO (Ciclo 3B): sem escrita da aplicação desde esta migration — 0 linhas reais no momento da migração. Bloqueios operacionais agora vivem em room_blocks. Mantida sem DROP por não haver necessidade de removê-la; pode ser removida num ciclo futuro após confirmação de que nada mais depende dela.';

-- ----------------------------------------------------------------------------
-- (B.1) Origem do bloqueio — só rastreabilidade, não afeta a lógica.
-- ----------------------------------------------------------------------------
alter table room_blocks add column if not exists source text not null default 'dashboard';

-- ----------------------------------------------------------------------------
-- (B.2) create_room_block: novo parâmetro opcional no FINAL da lista (compatível
-- com chamadas existentes, que continuam usando o default 'dashboard').
-- ----------------------------------------------------------------------------
create or replace function create_room_block(
  p_pousada_id uuid, p_room_id uuid, p_block_type room_block_type,
  p_starts_at timestamptz, p_ends_at timestamptz, p_reason text, p_notes text default '',
  p_source text default 'dashboard'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_room_status accommodation_status;
  v_room_pousada uuid;
  v_conflict_block uuid;
  v_conflict_booking text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not auth_can_manage_pousada(p_pousada_id) then
    raise exception 'Você não tem permissão para bloquear acomodações nesta pousada.';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'A data final deve ser posterior à inicial.';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Informe o motivo do bloqueio.';
  end if;

  select status, pousada_id into v_room_status, v_room_pousada from rooms where id = p_room_id;
  if v_room_pousada is null then raise exception 'Acomodação não encontrada.'; end if;
  if v_room_pousada <> p_pousada_id then raise exception 'Acomodação não pertence a esta pousada.'; end if;
  if v_room_status <> 'active' then raise exception 'Não é possível bloquear uma acomodação inativa.'; end if;

  select id into v_conflict_block from room_blocks
  where room_id = p_room_id and status = 'active'
    and starts_at < p_ends_at and ends_at > p_starts_at
  limit 1;
  if v_conflict_block is not null then
    raise exception 'Já existe um bloqueio ativo para esta acomodação nesse período.';
  end if;

  select code into v_conflict_booking from bookings
  where room_id = p_room_id
    and status in ('iniciada', 'aguardando_pagamento', 'confirmada', 'em_estadia')
    and checkin < p_ends_at::date and checkout > p_starts_at::date
  limit 1;
  if v_conflict_booking is not null then
    raise exception 'Existe uma reserva (%) conflitando com este período.', v_conflict_booking;
  end if;

  insert into room_blocks (pousada_id, room_id, block_type, starts_at, ends_at, reason, notes, created_by, source)
  values (p_pousada_id, p_room_id, p_block_type, p_starts_at, p_ends_at, p_reason, coalesce(p_notes, ''), auth.uid(), p_source)
  returning id into v_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'room_block.created', 'room_blocks', v_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'roomId', p_room_id, 'type', p_block_type, 'source', p_source));

  return jsonb_build_object('status', 'ok', 'id', v_id);
end;
$$;
-- Grants preservados pelo create or replace (mesmo nome; novo parâmetro tem default).

-- ----------------------------------------------------------------------------
-- (B.3) Helper de leitura de `rooms` — só papéis com ação de estrutura/preço
-- na matriz (proprietario, admin_pousada, recepcionista). Governança fica de
-- fora (usa a RPC de projeção abaixo); financeiro_pousada fica de fora (não
-- tem nenhuma ação sobre acomodações na matriz — nunca deveria ter tido
-- acesso de leitura direta).
-- ----------------------------------------------------------------------------
create or replace function auth_has_room_read_access(target_pousada uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid()
      and m.pousada_id = target_pousada
      and m.role in ('proprietario', 'admin_pousada', 'recepcionista')
      and m.status = 'active'
  );
$$;
revoke execute on function auth_has_room_read_access(uuid) from public;
grant execute on function auth_has_room_read_access(uuid) to anon, authenticated;

drop policy "rooms_read" on rooms;
create policy "rooms_read" on rooms for select
  using (
    exists (select 1 from pousadas p where p.id = rooms.pousada_id and p.status = 'publicada')
    or auth_has_room_read_access(pousada_id)
    or auth_is_platform_admin()
  );
-- rooms_write (0002) inalterada — já era só proprietario/admin_pousada.

-- ----------------------------------------------------------------------------
-- (B.4) Projeção operacional mínima para Governança — nunca inclui
-- base_price, notas comerciais, categoria ou visibilidade pública.
-- ----------------------------------------------------------------------------
create or replace function list_rooms_for_housekeeping(p_pousada_id uuid)
returns table(
  id uuid,
  name text,
  code text,
  location text,
  operational_status room_operational_status,
  capacity integer,
  next_block_starts_at timestamptz,
  operational_note text
)
language sql stable security definer set search_path = public as $$
  select
    r.id, r.name, r.code, r.location, r.operational_status, r.capacity,
    (
      select min(b.starts_at) from room_blocks b
      where b.room_id = r.id and b.status = 'active' and b.ends_at > now()
    ),
    r.operational_description
  from rooms r
  where r.pousada_id = p_pousada_id
    and (
      exists (
        select 1 from memberships m
        where m.user_id = auth.uid()
          and m.pousada_id = p_pousada_id
          and m.role in ('proprietario', 'admin_pousada', 'governanca')
          and m.status = 'active'
      )
      or auth_is_platform_admin()
    );
$$;
revoke execute on function list_rooms_for_housekeeping(uuid) from public;
revoke execute on function list_rooms_for_housekeeping(uuid) from anon;
grant execute on function list_rooms_for_housekeeping(uuid) to authenticated;
