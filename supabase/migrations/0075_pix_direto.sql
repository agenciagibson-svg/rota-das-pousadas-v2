-- =============================================================================
-- 0075 — Pix direto na conta da pousada, com comprovante e aprovação.
--
-- Fluxo:
--   1. O proprietário cadastra a chave Pix da pousada (pousada_pix_settings).
--   2. Na página de pagamento o hóspede vê QR Code + "copia e cola" (gerados
--      no app a partir da chave, com o valor e o código da reserva), paga no
--      app do banco e envia o comprovante (Storage, bucket privado).
--   3. `submit_payment_proof` registra o comprovante e congela o prazo da
--      reserva (payment_due_at = null): a reserva fica "aguardando aprovação"
--      e as datas continuam guardadas — a expiração automática (0050/0070)
--      só mexe em pendência COM prazo vencido.
--   4. A equipe da pousada (quem registra pagamento) aprova ou recusa em
--      `review_payment_proof`. Aprovar grava o pagamento e confirma a reserva
--      como o webhook do Mercado Pago faz; recusar devolve 2 horas de prazo
--      para o hóspede enviar outro comprovante.
--
-- A Rota nunca toca no dinheiro: só guarda a chave e o comprovante.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- (A) Chave Pix da pousada
-- ----------------------------------------------------------------------------
create table pousada_pix_settings (
  pousada_id  uuid primary key references pousadas(id) on delete cascade,
  key_type    text not null check (key_type in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  pix_key     text not null check (length(pix_key) between 3 and 77),
  holder_name text not null check (length(trim(holder_name)) between 2 and 100),
  city        text not null check (length(trim(city)) between 2 and 60),
  enabled     boolean not null default true,
  updated_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table pousada_pix_settings enable row level security;
-- Leitura: equipe operacional da pousada (vê para conferir extrato). Hóspede
-- recebe a chave só pela RPC da própria reserva (get_booking_pix_instructions).
create policy "pix_settings_staff_read" on pousada_pix_settings for select
  using (auth_has_operational_access(pousada_id));
-- Escrita só pela RPC abaixo (só o proprietário — para onde vai o dinheiro).
revoke insert, update, delete on pousada_pix_settings from anon, authenticated;
grant select on pousada_pix_settings to authenticated;

create or replace function save_pousada_pix_settings(
  p_pousada_id uuid,
  p_key_type text,
  p_pix_key text,
  p_holder_name text,
  p_city text,
  p_enabled boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not auth_is_active_owner_of(p_pousada_id) then
    raise exception 'Só o proprietário pode alterar a chave Pix da pousada.';
  end if;
  if p_key_type not in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria') then
    raise exception 'Tipo de chave Pix inválido.';
  end if;

  insert into pousada_pix_settings (pousada_id, key_type, pix_key, holder_name, city, enabled, updated_by)
  values (p_pousada_id, p_key_type, trim(p_pix_key), trim(p_holder_name), trim(p_city), coalesce(p_enabled, true), auth.uid())
  on conflict (pousada_id) do update set
    key_type = excluded.key_type,
    pix_key = excluded.pix_key,
    holder_name = excluded.holder_name,
    city = excluded.city,
    enabled = excluded.enabled,
    updated_by = excluded.updated_by,
    updated_at = now();

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'pousada.pix_settings_updated', 'pousadas', p_pousada_id,
          jsonb_build_object('keyType', p_key_type, 'enabled', coalesce(p_enabled, true)));
end;
$$;
revoke all on function save_pousada_pix_settings(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function save_pousada_pix_settings(uuid, text, text, text, text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- (B) Comprovantes
-- ----------------------------------------------------------------------------
create type payment_proof_status as enum ('submitted', 'approved', 'rejected');

create table payment_proofs (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references bookings(id) on delete cascade,
  pousada_id       uuid not null references pousadas(id) on delete cascade,
  uploaded_by      uuid not null references auth.users(id),
  file_path        text not null,
  file_name        text not null default '',
  mime_type        text not null,
  size_bytes       integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  amount           numeric(14,2) not null check (amount > 0),
  status           payment_proof_status not null default 'submitted',
  reviewed_by      uuid references auth.users(id),
  reviewed_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz not null default now()
);
create index idx_payment_proofs_booking on payment_proofs (booking_id, created_at desc);
create index idx_payment_proofs_pousada_open on payment_proofs (pousada_id) where status = 'submitted';
-- No máximo um comprovante em análise por reserva.
create unique index uq_payment_proofs_one_open on payment_proofs (booking_id) where status = 'submitted';

alter table payment_proofs enable row level security;
create policy "payment_proofs_read" on payment_proofs for select
  using (uploaded_by = auth.uid() or auth_has_operational_access(pousada_id));
revoke insert, update, delete on payment_proofs from anon, authenticated;
grant select on payment_proofs to authenticated;

-- ----------------------------------------------------------------------------
-- (C) Storage: bucket privado. Caminho = <booking_id>/<arquivo>.
-- Hóspede sobe só na própria reserva pendente; lê o que é dele; a equipe
-- operacional da pousada lê os comprovantes das reservas dela.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function payment_proof_booking_id(object_name text)
returns uuid language plpgsql immutable as $$
begin
  return (split_part(object_name, '/', 1))::uuid;
exception when others then
  return null;
end;
$$;

create policy "payment_proofs_upload_own_pending" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from bookings b
      where b.id = payment_proof_booking_id(name)
        and b.guest_id = auth.uid()
        and b.status = 'pending'
    )
  );

create policy "payment_proofs_read_own_or_staff" on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from bookings b
      where b.id = payment_proof_booking_id(name)
        and (b.guest_id = auth.uid() or auth_has_operational_access(b.pousada_id))
    )
  );

-- ----------------------------------------------------------------------------
-- (D) Instruções de Pix para o hóspede da reserva
-- ----------------------------------------------------------------------------
create or replace function get_booking_pix_instructions(p_booking_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_b bookings%rowtype;
  v_pix pousada_pix_settings%rowtype;
  v_proof payment_proofs%rowtype;
begin
  select * into v_b from bookings where id = p_booking_id;
  if not found or (v_b.guest_id is distinct from auth.uid() and not auth_has_operational_access(v_b.pousada_id)) then
    return null;
  end if;

  select * into v_pix from pousada_pix_settings where pousada_id = v_b.pousada_id and enabled;
  select * into v_proof from payment_proofs where booking_id = p_booking_id order by created_at desc limit 1;

  return jsonb_build_object(
    'enabled', v_pix.pousada_id is not null,
    'keyType', v_pix.key_type,
    'pixKey', v_pix.pix_key,
    'holderName', v_pix.holder_name,
    'city', v_pix.city,
    'lastProof', case when v_proof.id is null then null else jsonb_build_object(
      'id', v_proof.id,
      'status', v_proof.status,
      'fileName', v_proof.file_name,
      'createdAt', v_proof.created_at,
      'rejectionReason', v_proof.rejection_reason
    ) end
  );
end;
$$;
revoke all on function get_booking_pix_instructions(uuid) from public, anon;
grant execute on function get_booking_pix_instructions(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- (E) Hóspede envia o comprovante
-- ----------------------------------------------------------------------------
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

  -- Reenvio enquanto ainda está em análise: o anterior sai da fila.
  update payment_proofs set status = 'rejected', reviewed_at = now(),
         rejection_reason = 'Substituído por um novo envio do hóspede.'
   where booking_id = p_booking_id and status = 'submitted';

  insert into payment_proofs (booking_id, pousada_id, uploaded_by, file_path, file_name, mime_type, size_bytes, amount)
  values (p_booking_id, v_b.pousada_id, auth.uid(), p_file_path, left(coalesce(p_file_name, ''), 150),
          p_mime_type, p_size_bytes, v_b.balance_due)
  returning id into v_id;

  -- Em análise: sem prazo (as datas continuam guardadas até a pousada decidir).
  update bookings set payment_due_at = null, version = version + 1, updated_at = now()
   where id = p_booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'payment_proof.submitted', 'bookings', p_booking_id,
          jsonb_build_object('proofId', v_id, 'amount', v_b.balance_due));

  return jsonb_build_object('id', v_id, 'amount', v_b.balance_due);
end;
$$;
revoke all on function submit_payment_proof(uuid, text, text, text, integer) from public, anon;
grant execute on function submit_payment_proof(uuid, text, text, text, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- (F) Equipe da pousada aprova ou recusa
-- ----------------------------------------------------------------------------
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
    -- Devolve prazo para o hóspede corrigir (enviar outro comprovante ou pagar de outro jeito).
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

-- ----------------------------------------------------------------------------
-- (G) E-mails de aviso da pousada (só o servidor, com service_role): o
-- e-mail de notificação da pousada + proprietários/administradores ativos.
-- ----------------------------------------------------------------------------
create or replace function get_pousada_alert_emails(p_booking_id uuid)
returns table(email text)
language sql stable security definer set search_path = public as $$
  select distinct lower(e) from (
    select nullif(trim(p.notification_email), '') as e
      from bookings b join pousadas p on p.id = b.pousada_id
     where b.id = p_booking_id
    union all
    select u.email
      from bookings b
      join memberships m on m.pousada_id = b.pousada_id
      join auth.users u on u.id = m.user_id
     where b.id = p_booking_id
       and m.status = 'active'
       and m.role in ('proprietario', 'admin_pousada', 'financeiro_pousada', 'recepcionista')
  ) s where e is not null;
$$;
revoke all on function get_pousada_alert_emails(uuid) from public, anon, authenticated;
grant execute on function get_pousada_alert_emails(uuid) to service_role;

comment on table payment_proofs is
  '0075: comprovantes de Pix direto. Escrita só por submit_payment_proof / review_payment_proof.';
