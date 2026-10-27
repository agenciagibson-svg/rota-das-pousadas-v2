-- =============================================================================
-- 0096 — Mapa de ocupação: mover reserva (quarto e/ou datas) num passo só.
--
-- O mapa de ocupação do painel (/dashboard/reservas/ocupacao) deixa a recepção
-- arrastar a barra de uma reserva para outro quarto ou outras datas, ou puxar
-- a borda para mudar a saída. `update_booking` (0034/0083) já troca quarto e
-- datas, mas pede a reserva inteira (hóspede, valores, origem...) vinda do
-- cliente, não trava nada além da EXCLUDE constraint, deixa mover reserva do
-- Airbnb/Booking e reserva com check-in feito sem regra. Esta função faz só a
-- mudança de lugar, com as regras abaixo, e nunca aceita valor do cliente.
--
-- Regras:
--   * Quem: equipe com `booking:manage` na pousada da reserva — mesmo helper do
--     `update_booking` (`auth_has_guest_access`: proprietário, gestor e
--     recepção) ou concessão de plataforma ativa (`auth_has_active_grant`).
--     Conferido ANTES de qualquer lock (lição da 0083 G).
--   * Status: pending e confirmed mudam quarto, entrada e saída. checked_in só
--     muda a SAÍDA (estender ou encurtar), no mesmo quarto: as noites já
--     dormidas são fato, e a reserva tem um quarto só — trocar de quarto no
--     meio da estadia reescreveria o histórico das noites passadas. Demais
--     status (cotação, concluída, cancelada, não compareceu) não se movem.
--   * Datas: entrada nova não pode ser no passado (no fuso da pousada); com
--     check-in feito, a saída nova não pode ser antes de hoje.
--   * Canal: reserva com origem Airbnb, Booking.com ou Expedia é espelho do
--     canal — mudar aqui não muda lá. Recusa e orienta a mudar no canal. A
--     ocupação importada por iCal nem é reserva (`channel_events`, 0044): o
--     mapa mostra como faixa fixa e ela continua barrando a mudança via
--     `assert_room_available_for_booking` (0062).
--   * Disponibilidade: `assert_room_available_for_booking` com a própria
--     reserva excluída — mesma regra da criação e da edição (quarto da mesma
--     pousada, ativo, sem manutenção, capacidade, pets, bloqueios, outras
--     reservas, calendário do canal). Pendência vencida que estiver no caminho
--     é expirada como `create_booking` faz (0070), com auditoria.
--   * Valor: por padrão o total combinado NÃO muda. Com `p_reprice`, as diárias
--     (subtotal) passam a ser as das tarifas (`room_stay_quote`, 0087) para o
--     quarto e as datas novas; taxa, desconto, acréscimo e serviços ficam como
--     estavam. Nunca abaixo do que já foi pago — nesse caso recusa e orienta a
--     usar a edição da reserva (onde se registra a devolução).
--
-- Locks, na ordem fixa: advisory lock por quarto (origem e destino, em ordem
-- de uuid — duas mudanças cruzadas A→B e B→A não se travam) e depois a linha
-- da reserva (`for update`), igual à 0042 (advisory e depois reserva). Duas
-- mudanças que disputam o mesmo quarto ficam em fila; reserva x reserva
-- continua garantida pela EXCLUDE `bookings_no_overlap` (0033).
-- Limite conhecido: `create_booking` e `create_room_block` não pegam o lock do
-- quarto; uma criação de bloqueio simultânea a uma mudança ainda pode passar
-- (o mesmo vale hoje para criação de reserva x bloqueio).
--
-- Auditoria: as mesmas ações que `update_booking` grava
-- (`booking.period_changed`, `booking.room_changed`, `booking.values_changed`),
-- com `via = 'mapa_ocupacao'` no metadata.
--
-- Reversão: supabase/rollback/0096_rollback.sql
-- =============================================================================

create or replace function public.move_booking(
  p_booking_id uuid,
  p_version integer,
  p_room_id uuid,
  p_checkin date,
  p_checkout date,
  p_reprice boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pousada uuid;
  v_room_before uuid;
  v_first_lock uuid;
  v_second_lock uuid;
  v_b bookings%rowtype;
  v_today date;
  v_stale record;
  v_quote integer;
  v_subtotal integer;
  v_total integer;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if p_booking_id is null or p_version is null or p_room_id is null
     or p_checkin is null or p_checkout is null then
    raise exception 'Informe o quarto e as datas.';
  end if;
  if p_checkout <= p_checkin then
    raise exception 'A data de saída deve ser posterior à de entrada.';
  end if;
  if p_checkout - p_checkin > 366 then
    raise exception 'Período longo demais.';
  end if;

  -- 1) Permissão antes de travar qualquer coisa. Mesma resposta para reserva
  --    inexistente e reserva de outra pousada (não revela o que existe).
  select pousada_id, room_id into v_pousada, v_room_before from bookings where id = p_booking_id;
  if v_pousada is null
     or not (auth_has_guest_access(v_pousada) or auth_has_active_grant(v_pousada)) then
    raise exception 'Você não tem permissão para mover esta reserva.';
  end if;

  -- 2) Locks na ordem fixa: quartos (uuid menor primeiro), depois a reserva.
  v_first_lock := least(v_room_before, p_room_id);
  v_second_lock := greatest(v_room_before, p_room_id);
  perform pg_advisory_xact_lock(hashtextextended('room_inventory:' || v_first_lock::text, 0));
  if v_second_lock <> v_first_lock then
    perform pg_advisory_xact_lock(hashtextextended('room_inventory:' || v_second_lock::text, 0));
  end if;
  select * into v_b from bookings where id = p_booking_id for update;

  -- Mudou entre a leitura e o lock (outra aba, outra pessoa): pede recarregar.
  if v_b.id is null or v_b.version <> p_version or v_b.room_id <> v_room_before then
    raise exception 'Esta reserva foi alterada por outro usuário. Recarregue e tente novamente.';
  end if;

  -- 3) Reserva de canal é espelho da OTA.
  if v_b.origin in ('airbnb', 'booking_com', 'expedia') then
    raise exception 'Reserva do % não se move por aqui: mude primeiro no canal e depois ajuste em Editar reserva.',
      case v_b.origin when 'airbnb' then 'Airbnb' when 'booking_com' then 'Booking.com' else 'Expedia' end;
  end if;

  -- 4) Status e datas.
  if v_b.status not in ('pending', 'confirmed', 'checked_in') then
    raise exception 'Só dá para mover reserva aguardando pagamento, confirmada ou em estadia.';
  end if;
  if p_room_id = v_b.room_id and p_checkin = v_b.checkin and p_checkout = v_b.checkout then
    raise exception 'A reserva já está nesse quarto e nessas datas.';
  end if;
  v_today := pousada_local_date(v_b.pousada_id);
  if v_b.status = 'checked_in' then
    if p_room_id <> v_b.room_id or p_checkin <> v_b.checkin then
      raise exception 'O hóspede já fez check-in: aqui só dá para mudar a data de saída.';
    end if;
    if p_checkout < v_today then
      raise exception 'A nova saída não pode ser antes de hoje.';
    end if;
  else
    if p_checkin <> v_b.checkin and p_checkin < v_today then
      raise exception 'A nova entrada não pode ser no passado.';
    end if;
    if p_checkout <= v_today and p_checkout <> v_b.checkout then
      raise exception 'A nova saída precisa ser depois de hoje.';
    end if;
  end if;

  -- 5) Pendência vencida no caminho (mesma regra de create_booking, 0070).
  for v_stale in
    select id from bookings
    where room_id = p_room_id and id <> p_booking_id and status = 'pending'
      and payment_due_at is not null and payment_due_at < now()
      and checkin < p_checkout and checkout > p_checkin
  loop
    update bookings set status = 'cancelled', cancellation_reason = 'Prazo de pagamento expirado',
      cancelled_at = now(), version = version + 1
    where id = v_stale.id;
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (null, 'booking.expired', 'bookings', v_stale.id, jsonb_build_object('reason', 'payment_due_at_passed'));
  end loop;

  -- 6) Disponibilidade (a linha ainda tem as datas antigas: o eco do iCal
  --    nas noites que a reserva já ocupava não conta, 0062).
  perform assert_room_available_for_booking(
    v_b.pousada_id, p_room_id, p_checkin, p_checkout, v_b.adults, v_b.children, v_b.pets, p_booking_id
  );

  -- 7) Valor.
  v_subtotal := v_b.subtotal;
  v_total := v_b.total;
  if coalesce(p_reprice, false) then
    select q.total into v_quote from room_stay_quote(p_room_id, p_checkin, p_checkout) q;
    if v_quote is null then raise exception 'Não foi possível calcular o valor pelas tarifas.'; end if;
    v_subtotal := v_quote;
    v_total := greatest(0, v_b.total - v_b.subtotal + v_quote);
    if v_total < v_b.amount_received then
      raise exception 'O valor novo fica abaixo do que já foi pago. Mantenha o valor combinado ou ajuste em Editar reserva.';
    end if;
  end if;

  begin
    update bookings set
      room_id = p_room_id, checkin = p_checkin, checkout = p_checkout,
      subtotal = v_subtotal, total = v_total,
      version = version + 1, updated_by = auth.uid(), updated_at = now()
    where id = p_booking_id;
  exception when exclusion_violation then
    raise exception 'Já existe uma reserva conflitando com este período para esta acomodação.';
  end;

  -- 8) Auditoria (mesmas ações do update_booking).
  if p_checkin <> v_b.checkin or p_checkout <> v_b.checkout then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'booking.period_changed', 'bookings', p_booking_id,
            jsonb_build_object('from', jsonb_build_object('checkin', v_b.checkin, 'checkout', v_b.checkout),
                               'to', jsonb_build_object('checkin', p_checkin, 'checkout', p_checkout),
                               'via', 'mapa_ocupacao'));
  end if;
  if p_room_id <> v_b.room_id then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'booking.room_changed', 'bookings', p_booking_id,
            jsonb_build_object('from', v_b.room_id, 'to', p_room_id, 'via', 'mapa_ocupacao'));
  end if;
  if v_total <> v_b.total then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'booking.values_changed', 'bookings', p_booking_id,
            jsonb_build_object('from', v_b.total, 'to', v_total, 'via', 'mapa_ocupacao', 'reason', 'tarifas'));
  end if;

  return jsonb_build_object(
    'id', p_booking_id, 'version', v_b.version + 1,
    'roomId', p_room_id, 'checkin', p_checkin, 'checkout', p_checkout,
    'previousTotal', v_b.total, 'total', v_total
  );
end;
$$;

comment on function public.move_booking(uuid, integer, uuid, date, date, boolean) is
  'Mapa de ocupação (0096): muda quarto e/ou datas de uma reserva com as regras de status, canal, disponibilidade e valor descritas na migration.';

revoke execute on function public.move_booking(uuid, integer, uuid, date, date, boolean) from public, anon;
grant execute on function public.move_booking(uuid, integer, uuid, date, date, boolean) to authenticated;
