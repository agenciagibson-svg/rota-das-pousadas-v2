-- =============================================================================
-- 0082 — Pix direto: prazo de análise, valor conferido e fila de revisão de
-- pagamentos. Revisão de 01/10/2026 (QA M-1, backend M-2 e B-6).
--
-- (A) Comprovante enviado não segura mais o quarto sem prazo. Antes,
--     `submit_payment_proof` zerava `payment_due_at`: qualquer imagem bloqueava
--     as datas até alguém recusar. Agora a pousada tem 24h para analisar; se
--     não analisar, a expiração normal (cron 0050 / create_booking 0070)
--     cancela a reserva e o caso cai na fila de revisão (C), porque o hóspede
--     pode ter pago de verdade. Teto de 5 comprovantes por conta por dia.
--
-- (B) Aprovar o comprovante credita o VALOR CONFERIDO no extrato, não o saldo
--     inteiro. `review_payment_proof` ganha `p_amount` (opcional para não
--     quebrar quem chama sem ele: sem valor = saldo inteiro, como antes).
--     Valor menor que o saldo: pagamento parcial — a reserva continua
--     aguardando o restante, com novo prazo de 24h.
--
-- (C) `payment_reviews`: fila de casos de dinheiro que precisam de uma pessoa.
--     Entram aqui, automaticamente:
--       * reserva cancelada/expirada com comprovante Pix ainda em análise;
--       * pagamento do Mercado Pago que chegou em reserva já cancelada,
--         estorno, ou valor acima do total (o `requiresReview` que a 0042 só
--         gravava no audit_log e ninguém lia).
--     A equipe resolve com uma anotação (ex.: "devolvido por Pix em 02/10").
--     `notified_at` controla o e-mail de aviso (enviado pelo servidor).
--
-- Reversão: supabase/rollback/0082_rollback.sql.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- (C) Fila de revisão
-- ----------------------------------------------------------------------------
create table payment_reviews (
  id           uuid primary key default gen_random_uuid(),
  pousada_id   uuid not null references pousadas(id) on delete cascade,
  booking_id   uuid not null references bookings(id) on delete cascade,
  kind         text not null check (kind in (
                 'pix_sem_analise',        -- reserva caiu com comprovante em análise
                 'pago_reserva_cancelada', -- MP aprovado em reserva cancelada/no-show
                 'estorno',                -- MP estornado/parcialmente devolvido
                 'valor_excedente'         -- recebido acima do total
               )),
  source       text not null check (source in ('pix_direto', 'mercado_pago')),
  ref          text not null,              -- id do comprovante ou do pagamento
  amount       numeric(14,2) not null default 0,
  status       text not null default 'aberta' check (status in ('aberta', 'resolvida')),
  resolution   text check (resolution is null or length(resolution) between 3 and 500),
  resolved_by  uuid references auth.users(id),
  resolved_at  timestamptz,
  notified_at  timestamptz,
  created_at   timestamptz not null default now()
);
create unique index uq_payment_reviews_kind_ref on payment_reviews (kind, ref);
create index idx_payment_reviews_pousada_open on payment_reviews (pousada_id) where status = 'aberta';
create index idx_payment_reviews_booking on payment_reviews (booking_id);

alter table payment_reviews enable row level security;
create policy "payment_reviews_read" on payment_reviews for select
  using (auth_has_operational_access(pousada_id) or auth_is_platform_admin());
revoke insert, update, delete on payment_reviews from anon, authenticated;
grant select on payment_reviews to authenticated;

create or replace function open_payment_review(
  p_booking_id uuid, p_kind text, p_source text, p_ref text, p_amount numeric
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pousada uuid;
begin
  select pousada_id into v_pousada from bookings where id = p_booking_id;
  if v_pousada is null then return; end if;
  insert into payment_reviews (pousada_id, booking_id, kind, source, ref, amount)
  values (v_pousada, p_booking_id, p_kind, p_source, p_ref, coalesce(p_amount, 0))
  on conflict (kind, ref) do nothing;
end;
$$;
revoke all on function open_payment_review(uuid, text, text, text, numeric) from public, anon, authenticated;

-- Equipe da pousada (proprietário/admin) ou comercial/master da Rota resolve.
create or replace function resolve_payment_review(p_review_id uuid, p_resolution text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_r payment_reviews%rowtype;
begin
  select * into v_r from payment_reviews where id = p_review_id for update;
  if not found or not (auth_can_manage_pousada(v_r.pousada_id) or auth_can_manage_pousadas_platform()) then
    raise exception 'Revisão não encontrada.';
  end if;
  if v_r.status = 'resolvida' then
    raise exception 'Este caso já foi resolvido.';
  end if;
  if length(trim(coalesce(p_resolution, ''))) < 3 then
    raise exception 'Conte o que foi feito (ex.: valor devolvido ao hóspede).';
  end if;
  update payment_reviews
     set status = 'resolvida', resolution = left(trim(p_resolution), 500),
         resolved_by = auth.uid(), resolved_at = now()
   where id = v_r.id;
  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'payment_review.resolved', 'bookings', v_r.booking_id,
          jsonb_build_object('reviewId', v_r.id, 'kind', v_r.kind, 'resolution', left(trim(p_resolution), 500)));
end;
$$;
revoke all on function resolve_payment_review(uuid, text) from public, anon;
grant execute on function resolve_payment_review(uuid, text) to authenticated;

-- Para o e-mail de aviso: devolve os casos ainda não avisados e marca como
-- avisados na mesma transação (duas rodadas simultâneas não duplicam).
create or replace function claim_payment_reviews_to_notify()
returns table (review_id uuid, booking_id uuid, kind text, amount numeric)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update payment_reviews r set notified_at = now()
   where r.id in (
     select id from payment_reviews
      where notified_at is null and status = 'aberta'
      order by created_at
      limit 50
      for update skip locked)
  returning r.id, r.booking_id, r.kind, r.amount;
end;
$$;
revoke all on function claim_payment_reviews_to_notify() from public, anon, authenticated;
grant execute on function claim_payment_reviews_to_notify() to service_role;

-- Gatilho 1: reserva sai de "pending" (expirada, cancelada, no-show) com
-- comprovante ainda em análise → o comprovante é fechado e o caso vai para a fila.
create or replace function payment_review_on_booking_drop()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_p payment_proofs%rowtype;
begin
  for v_p in
    select * from payment_proofs where booking_id = new.id and status = 'submitted'
  loop
    update payment_proofs
       set status = 'rejected', reviewed_at = now(),
           rejection_reason = 'A reserva foi cancelada antes da análise do comprovante.'
     where id = v_p.id;
    perform open_payment_review(new.id, 'pix_sem_analise', 'pix_direto', v_p.id::text, v_p.amount);
  end loop;
  return new;
end;
$$;
revoke all on function payment_review_on_booking_drop() from public, anon, authenticated;

drop trigger if exists trg_payment_review_on_booking_drop on bookings;
create trigger trg_payment_review_on_booking_drop
  after update of status on bookings
  for each row
  when (old.status = 'pending' and new.status in ('cancelled', 'no_show'))
  execute function payment_review_on_booking_drop();

-- Gatilho 2: o `requiresReview` do Mercado Pago (0042) vira item da fila.
create or replace function payment_review_from_reconcile()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_booking uuid := nullif(new.metadata->>'bookingId', '')::uuid;
  v_status text;
  v_kind text;
begin
  if v_booking is null then return new; end if;
  select status::text into v_status from bookings where id = v_booking;
  v_kind := case
    when new.metadata->>'status' = 'estornado'
      or coalesce((new.metadata->>'refundedAmount')::numeric, 0) > 0 then 'estorno'
    when v_status in ('cancelled', 'no_show') then 'pago_reserva_cancelada'
    else 'valor_excedente'
  end;
  perform open_payment_review(v_booking, v_kind, 'mercado_pago', new.target_id::text,
                              (new.metadata->>'amount')::numeric);
  return new;
end;
$$;
revoke all on function payment_review_from_reconcile() from public, anon, authenticated;

drop trigger if exists trg_payment_review_from_reconcile on audit_log;
create trigger trg_payment_review_from_reconcile
  after insert on audit_log
  for each row
  when (new.action = 'payment.reconciled' and (new.metadata->>'requiresReview') = 'true')
  execute function payment_review_from_reconcile();

-- ----------------------------------------------------------------------------
-- (A) Envio do comprovante: prazo de 24h para a análise + teto diário
-- ----------------------------------------------------------------------------
alter table payment_proofs add column approved_amount numeric(14,2)
  check (approved_amount is null or approved_amount > 0);

create or replace function submit_payment_proof(
  p_booking_id uuid,
  p_file_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_b bookings%rowtype;
  v_id uuid;
  v_due timestamptz := now() + interval '24 hours';
begin
  select * into v_b from bookings where id = p_booking_id for update;
  if not found or v_b.guest_id is distinct from auth.uid() then
    raise exception 'Reserva não encontrada.';
  end if;
  if v_b.status <> 'pending' or v_b.balance_due <= 0 then
    raise exception 'Esta reserva não está aguardando pagamento.';
  end if;
  if v_b.payment_due_at is not null and v_b.payment_due_at <= now() then
    raise exception 'O prazo de pagamento desta reserva terminou. Faça uma nova reserva.';
  end if;
  if not exists (select 1 from pousada_pix_settings s where s.pousada_id = v_b.pousada_id and s.enabled) then
    raise exception 'Esta pousada não recebe Pix direto.';
  end if;
  if (select count(*) from payment_proofs
       where uploaded_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Você já enviou muitos comprovantes hoje. Fale com a pousada pelo WhatsApp.';
  end if;
  if p_file_path is null or split_part(p_file_path, '/', 1) <> p_booking_id::text
     or p_file_path like '%..%' then
    raise exception 'Arquivo de comprovante inválido.';
  end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf') then
    raise exception 'Envie uma foto (JPG, PNG) ou PDF do comprovante.';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'payment-proofs' and o.name = p_file_path) then
    raise exception 'O arquivo do comprovante não chegou. Tente enviar de novo.';
  end if;

  update payment_proofs set status = 'rejected', reviewed_at = now(),
         rejection_reason = 'Substituído por um novo envio do hóspede.'
   where booking_id = p_booking_id and status = 'submitted';

  insert into payment_proofs (booking_id, pousada_id, uploaded_by, file_path, file_name, mime_type, size_bytes, amount)
  values (p_booking_id, v_b.pousada_id, auth.uid(), p_file_path, left(coalesce(p_file_name, ''), 150),
          p_mime_type, p_size_bytes, v_b.balance_due)
  returning id into v_id;

  -- Em análise: as datas ficam guardadas por 24h (nunca menos que o prazo atual).
  update bookings set payment_due_at = greatest(coalesce(payment_due_at, v_due), v_due),
         version = version + 1, updated_at = now()
   where id = p_booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'payment_proof.submitted', 'bookings', p_booking_id,
          jsonb_build_object('proofId', v_id, 'amount', v_b.balance_due, 'reviewDueAt', v_due));

  return jsonb_build_object('id', v_id, 'amount', v_b.balance_due, 'reviewDueAt', v_due);
end;
$$;
revoke all on function submit_payment_proof(uuid, text, text, text, integer) from public, anon;
grant execute on function submit_payment_proof(uuid, text, text, text, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- (B) Aprovação com o valor conferido
-- ----------------------------------------------------------------------------
drop function if exists review_payment_proof(uuid, boolean, text);

create or replace function review_payment_proof(
  p_proof_id uuid,
  p_approve boolean,
  p_reason text default null,
  p_amount numeric default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_p payment_proofs%rowtype;
  v_b bookings%rowtype;
  v_amount numeric(14,2);
  v_payment_id uuid;
  v_confirmed boolean := false;
  v_remaining numeric(14,2) := 0;
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
    if v_b.balance_due <= 0 then raise exception 'Esta reserva não tem saldo a receber.'; end if;
    v_amount := coalesce(p_amount, v_b.balance_due);
    if v_amount <= 0 or v_amount <> round(v_amount, 2) then
      raise exception 'Informe o valor que entrou na conta.';
    end if;
    if v_amount > v_b.balance_due then
      raise exception 'O valor é maior que o saldo da reserva (R$ %). Aprove o saldo e combine a devolução do excedente com o hóspede.',
        to_char(v_b.balance_due, 'FM999G999G990D00');
    end if;

    insert into payments (booking_id, provider_ref, amount, status, method, provider_updated_at, refunded_amount, credited_amount)
    values (v_b.id, 'pix-direto:' || v_p.id, v_amount, 'aprovado', 'pix_direto', now(), 0, v_amount)
    returning id into v_payment_id;

    update bookings set amount_received = amount_received + v_amount,
           version = version + 1, updated_at = now()
     where id = v_b.id;
    v_remaining := v_b.total - (v_b.amount_received + v_amount);
    if v_remaining <= 0 then
      update bookings set status = 'confirmed', payment_due_at = null where id = v_b.id;
      v_confirmed := true;
      insert into audit_log (actor_id, action, target_table, target_id, metadata)
      values (auth.uid(), 'booking.confirmed', 'bookings', v_b.id,
              jsonb_build_object('source', 'pix_direto', 'from', v_b.status, 'proofId', v_p.id));
    elsif v_b.status = 'pending' then
      -- Pagamento parcial: 24h para o hóspede pagar o restante.
      update bookings set payment_due_at = now() + interval '24 hours' where id = v_b.id;
    end if;

    update payment_proofs set status = 'approved', approved_amount = v_amount,
           reviewed_by = auth.uid(), reviewed_at = now()
     where id = v_p.id;
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'payment_proof.approved', 'bookings', v_b.id,
            jsonb_build_object('proofId', v_p.id, 'paymentId', v_payment_id, 'amount', v_amount,
                               'expected', v_p.amount, 'remaining', greatest(v_remaining, 0)));
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

  return jsonb_build_object('bookingId', v_b.id, 'approved', p_approve, 'confirmed', v_confirmed,
                            'amount', v_amount, 'remaining', greatest(v_remaining, 0));
end;
$$;
revoke all on function review_payment_proof(uuid, boolean, text, numeric) from public, anon;
grant execute on function review_payment_proof(uuid, boolean, text, numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- Comprovantes que já estavam em análise sem prazo: ganham 48h a partir de agora.
-- ----------------------------------------------------------------------------
update bookings b set payment_due_at = now() + interval '48 hours', version = version + 1, updated_at = now()
 where b.status = 'pending' and b.payment_due_at is null
   and exists (select 1 from payment_proofs p where p.booking_id = b.id and p.status = 'submitted');
