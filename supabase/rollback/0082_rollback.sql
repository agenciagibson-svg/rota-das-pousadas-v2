-- Reverte 0082: volta o comprovante sem prazo, a aprovação do saldo inteiro e
-- remove a fila de revisão de pagamentos (os casos abertos se perdem).
drop trigger if exists trg_payment_review_from_reconcile on audit_log;
drop trigger if exists trg_payment_review_on_booking_drop on bookings;
drop function if exists payment_review_from_reconcile();
drop function if exists payment_review_on_booking_drop();
drop function if exists claim_payment_reviews_to_notify();
drop function if exists resolve_payment_review(uuid, text);
drop function if exists open_payment_review(uuid, text, text, text, numeric);
drop table if exists payment_reviews;

drop function if exists review_payment_proof(uuid, boolean, text, numeric);

create or replace function review_payment_proof(
  p_proof_id uuid,
  p_approve boolean,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_p payment_proofs%rowtype;
  v_b bookings%rowtype;
  v_amount numeric(14,2);
  v_payment_id uuid;
  v_confirmed boolean := false;
begin
  select * into v_p from payment_proofs where id = p_proof_id for update;
  if not found or not auth_has_operational_access(v_p.pousada_id) then
    raise exception 'Comprovante não encontrado.';
  end if;
  if v_p.status <> 'submitted' then
    raise exception 'Este comprovante já foi analisado.';
  end if;
  select * into v_b from bookings where id = v_p.booking_id for update;

  if p_approve then
    if v_b.status not in ('quote', 'pending') then
      raise exception 'A reserva não está mais aguardando pagamento (status: %).', v_b.status;
    end if;
    v_amount := v_b.balance_due;
    if v_amount <= 0 then raise exception 'Esta reserva não tem saldo a receber.'; end if;

    insert into payments (booking_id, provider_ref, amount, status, method, provider_updated_at, refunded_amount, credited_amount)
    values (v_b.id, 'pix-direto:' || v_p.id, v_amount, 'aprovado', 'pix_direto', now(), 0, v_amount)
    returning id into v_payment_id;

    update bookings set amount_received = amount_received + v_amount,
           version = version + 1, updated_at = now()
     where id = v_b.id;
    if v_b.amount_received + v_amount >= v_b.total then
      update bookings set status = 'confirmed' where id = v_b.id;
      v_confirmed := true;
      insert into audit_log (actor_id, action, target_table, target_id, metadata)
      values (auth.uid(), 'booking.confirmed', 'bookings', v_b.id,
              jsonb_build_object('source', 'pix_direto', 'from', v_b.status, 'proofId', v_p.id));
    end if;

    update payment_proofs set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
     where id = v_p.id;
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'payment_proof.approved', 'bookings', v_b.id,
            jsonb_build_object('proofId', v_p.id, 'paymentId', v_payment_id, 'amount', v_amount));
  else
    if length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception 'Informe o motivo da recusa para o hóspede.';
    end if;
    update payment_proofs set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
           rejection_reason = left(trim(p_reason), 300)
     where id = v_p.id;
    if v_b.status = 'pending' then
      update bookings set payment_due_at = now() + interval '2 hours', version = version + 1, updated_at = now()
       where id = v_b.id;
    end if;
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'payment_proof.rejected', 'bookings', v_b.id,
            jsonb_build_object('proofId', v_p.id, 'reason', left(trim(p_reason), 300)));
  end if;

  return jsonb_build_object('bookingId', v_b.id, 'approved', p_approve, 'confirmed', v_confirmed);
end;
$$;
revoke all on function review_payment_proof(uuid, boolean, text) from public, anon;
grant execute on function review_payment_proof(uuid, boolean, text) to authenticated;

alter table payment_proofs drop column if exists approved_amount;

-- submit_payment_proof volta à versão da 0075 (sem prazo de análise e sem teto
-- diário): reaplicar o bloco (E) de supabase/migrations/0075_pix_direto.sql.
