-- =============================================================================
-- 0066 — Avaliação só de quem se hospedou; a pousada só responde.
--
-- A intenção da 0002 era "autor cria/edita a própria; pousada responde", mas
-- as regras não impunham isso:
--   * `reviews_author_write` só exigia `author_id = auth.uid()`: qualquer
--     usuário logado, com qualquer reserva de qualquer pousada (até pendente),
--     publicava nota em QUALQUER pousada — e ainda podia preencher `response`
--     como se fosse a pousada.
--   * `reviews_update` deixava a equipe da pousada alterar a linha inteira:
--     o dono trocava a nota e o comentário do hóspede.
--
-- Agora a inserção exige reserva do próprio autor, naquela pousada, com a
-- estadia encerrada (check-out feito, ou confirmada com saída já passada), e
-- `response` vazio. Na edição, um trigger separa os papéis: o autor mexe na
-- própria nota/comentário, a pousada só na resposta; ninguém troca pousada,
-- reserva ou autor. Equipe da plataforma (moderação) e backend seguem livres.
-- =============================================================================

create or replace function auth_can_review_booking(p_booking_id uuid, p_pousada_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings b
    where b.id = p_booking_id
      and b.pousada_id = p_pousada_id
      and b.guest_id = auth.uid()
      and (
        b.status = 'checked_out'
        or (b.status in ('confirmed', 'checked_in') and b.checkout <= current_date)
      )
  );
$$;
revoke all on function auth_can_review_booking(uuid, uuid) from public, anon;
grant execute on function auth_can_review_booking(uuid, uuid) to authenticated;

drop policy if exists "reviews_author_write" on reviews;
create policy "reviews_author_write" on reviews for insert
  with check (
    author_id = auth.uid()
    and response is null
    and auth_can_review_booking(booking_id, pousada_id)
  );

create or replace function guard_review_changes()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth_is_platform_admin() then
    return new;
  end if;

  if new.pousada_id is distinct from old.pousada_id or new.booking_id is distinct from old.booking_id
     or new.author_id is distinct from old.author_id or new.created_at is distinct from old.created_at then
    raise exception 'A avaliação não pode mudar de pousada, reserva, autor ou data.';
  end if;

  if old.author_id = auth.uid() then
    if new.response is distinct from old.response then
      raise exception 'Só a pousada responde à avaliação.';
    end if;
  elsif new.rating is distinct from old.rating or new.text is distinct from old.text then
    raise exception 'A pousada só pode responder à avaliação, não alterar a nota ou o comentário do hóspede.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_review_changes on reviews;
create trigger trg_guard_review_changes
  before update on reviews
  for each row execute function guard_review_changes();
