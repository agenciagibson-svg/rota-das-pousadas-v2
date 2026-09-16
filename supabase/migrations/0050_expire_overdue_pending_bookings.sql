-- =============================================================================
-- 0050 — Expiração automática de pré-reserva vencida (cron).
--
-- `expire_pending_booking` (0034) já existe, mas exige sessão de usuário
-- (`auth.uid()`) e um `p_booking_id` — cobre só o botão manual "Expirar" na
-- tela de uma reserva. Sem isso, uma pendência vencida fica travada até
-- alguém abrir aquela reserva específica e clicar; na prática ninguém faz
-- isso e o quarto continua "ocupado" por uma reserva que nunca vai pagar.
--
-- `expire_overdue_pending_bookings()` é a versão em lote, sem tenant e sem
-- usuário — só `service_role` (mesmo padrão de `sync_channel_events`,
-- `list_channel_feeds_to_import` da 0044: o cron nunca toca tabela direto,
-- só chama uma RPC estreita concedida exclusivamente a `service_role`).
-- Continua sendo AÇÃO EXPLÍCITA E AUDITADA (RB seção 9: nunca expira
-- silenciosamente) — só que a "ação" é o cron, não um clique. A auditoria
-- registra `actor_id = null` e `metadata.source = 'cron'` para nunca ser
-- confundida com uma expiração manual (`metadata.source` ausente = manual).
--
-- Nunca toca reserva sem `payment_due_at` nem fora de `pending`; um `UPDATE`
-- único (sem CTE de leitura separada) já é seguro contra duas rodadas
-- concorrentes — a segunda só vê as linhas que a primeira não pegou.
-- =============================================================================

create or replace function expire_overdue_pending_bookings()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
begin
  with expired as (
    update bookings set
      status = 'cancelled',
      cancellation_reason = 'Prazo de pagamento expirado (expiração automática)',
      cancelled_at = now(),
      version = version + 1
    where status = 'pending'
      and payment_due_at is not null
      and payment_due_at < now()
    returning id
  )
  select array_agg(id) into v_ids from expired;

  if v_ids is not null then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    select null, 'booking.expired', 'bookings', b_id,
           jsonb_build_object('reason', 'payment_due_at_passed', 'source', 'cron')
    from unnest(v_ids) as b_id;
  end if;

  return jsonb_build_object('expired', coalesce(array_length(v_ids, 1), 0));
end;
$$;
revoke all on function expire_overdue_pending_bookings() from public, anon, authenticated;
grant execute on function expire_overdue_pending_bookings() to service_role;

comment on function expire_overdue_pending_bookings() is
  '0050: cron — cancela em lote toda pending com payment_due_at vencido. service_role só, sem sessão de usuário; auditoria com actor_id=null e metadata.source=cron.';
