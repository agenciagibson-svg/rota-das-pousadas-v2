-- =============================================================================
-- 0090 — Excluir a própria conta (LGPD art. 18, VI; Google Play / App Store).
--
-- DECISÃO: (b) ANONIMIZAR NO BANCO + EXCLUSÃO "SOFT" NO AUTH. A linha de
-- auth.users e a de profiles FICAM (como lápide sem dado pessoal); nenhuma
-- linha de pousada é apagada.
--
-- Por quê — mapa das chaves estrangeiras (catálogo do Postgres, 23/10/2026):
--   auth.users ← profiles.id                         ON DELETE CASCADE
--   auth.users ← traveler_profiles.user_id           ON DELETE CASCADE
--   auth.users ← payment_proofs.uploaded_by (NOT NULL), payment_proofs.reviewed_by,
--                payment_reviews.resolved_by, pousada_pix_settings.updated_by   NO ACTION
--   profiles   ← memberships.user_id, favorites.user_id,
--                favorite_alerts.user_id                                 CASCADE
--   profiles   ← growth_opportunities.*, growth_activities.created_by    SET NULL
--   profiles   ← bookings.guest_id / created_by / updated_by / cancelled_by /
--                checked_in_by / checked_out_by / no_show_by,
--                reviews.author_id (NOT NULL), audit_log.actor_id,
--                guests.user_id / created_by, pousadas.owner_id,
--                memberships.created_by / suspended_by, platform_access_grants.*,
--                rooms.*, room_blocks.*, accommodation_categories.created_by,
--                channel_calendars.created_by, quote_requests.handled_by,
--                pousada_payment_accounts.connected_by, platform_expenses.created_by,
--                inventory_movements.created_by, guest_orders.*_by,
--                consumption_payments.created_by                         NO ACTION
--
--   Apagar o usuário do Auth (hard delete) apaga `profiles` em cascata, e o
--   Postgres RECUSA enquanto houver qualquer uma das ~30 referências NO ACTION
--   acima. Para passar seria preciso: zerar `audit_log.actor_id` (reescrever a
--   trilha de auditoria — inaceitável), tirar o NOT NULL de `reviews.author_id`
--   e de `payment_proofs.uploaded_by` (comprovante de pagamento da pousada) e
--   zerar todos os `*_by` operacionais. Qualquer FK nova esquecida faria a
--   exclusão falhar DEPOIS de a RPC ter rodado (conta pela metade).
--
--   Com (b) nada disso muda: as referências continuam válidas, mas apontam para
--   uma lápide sem dado pessoal. Reserva, pagamento, comprovante, ficha FNRH,
--   avaliação, auditoria e financeiro continuam íntegros e legíveis pela
--   pousada (guarda por obrigação legal: Lei 11.771/2008, Decreto 7.381/2010,
--   legislação fiscal).
--
--   No Auth, o servidor chama `auth.admin.deleteUser(id, shouldSoftDelete=true)`
--   (features/auth/services/account-deletion.service.ts): o próprio Supabase
--   ofusca e-mail e telefone, apaga a senha, os metadados (nome), as
--   identidades (Google), os fatores e TODAS as sessões, e marca `deleted_at`.
--   Ninguém entra mais na conta, e o e-mail fica livre para um cadastro novo.
--   É mais forte que "banir" (ban mantém e-mail e senha guardados).
--
-- O que a RPC `delete_my_account()` faz (sempre sobre auth.uid()):
--   1. Recusa se há reserva pendente/confirmada/em estadia com checkout >= hoje
--      no fuso da pousada (pela conta OU por ficha de hóspede ligada à conta).
--   2. Recusa proprietário de pousada não encerrada e papel de plataforma.
--   3. Apaga o que é só da pessoa: perfil de viajante (FNRH, documento cifrado,
--      endereço, telefone), favoritos, alertas, vínculos de equipe que não são
--      de proprietário, convites, e as tentativas de login / pedidos de nova
--      senha guardados pelo e-mail.
--   4. Anonimiza `profiles` (nome "Conta excluída", avatar nulo, deleted_at).
--      `profiles` não tem telefone/CPF/endereço — eles moram em
--      `traveler_profiles`, apagada no passo 3.
--   5. Desvincula a conta das fichas `guests` (user_id = null) e das reservas
--      (guest_id = null). A ficha e a reserva continuam com a pousada.
--   6. Avaliações: nota e texto ficam. `reviews.author_id` é NOT NULL e o
--      gatilho `guard_review_changes` proíbe trocar o autor; com (b) ele aponta
--      para a lápide anônima — não sai nome em lugar nenhum (a vitrine nunca
--      mostra autor e o painel usa o nome gravado na reserva).
--   7. Grava `audit_log` `account.deleted` só com contagens.
--
-- Idempotente: chamada de novo numa conta já anonimizada devolve
-- `already_deleted` sem mexer em nada — permite repetir se a etapa do Auth
-- falhar depois da RPC.
--
-- Reversão: supabase/rollback/0090_rollback.sql (não "desexclui" contas).
-- =============================================================================

alter table public.profiles add column if not exists deleted_at timestamptz;
comment on column public.profiles.deleted_at is
  '0090: conta excluída pelo titular (delete_my_account). A linha fica como lápide anônima para preservar reservas, avaliações e auditoria da pousada.';
-- `authenticated` só tem UPDATE em (full_name, avatar_url, updated_at) — 0081.
-- `deleted_at` não entra nessa lista: só a RPC grava.

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile profiles%rowtype;
  v_email text;
  v_bookings integer := 0;
  v_guests integer := 0;
  v_memberships integer := 0;
  v_favorites integer := 0;
begin
  if v_uid is null then raise exception 'Faça login para continuar.'; end if;

  -- Trava a conta: duas abas excluindo ao mesmo tempo não fazem o serviço duas vezes.
  select * into v_profile from profiles where id = v_uid for update;
  if not found then raise exception 'Conta não encontrada.'; end if;
  if v_profile.deleted_at is not null then
    return jsonb_build_object('status', 'already_deleted');
  end if;

  if v_profile.platform_role is not null then
    raise exception 'Contas da equipe da Rota das Pousadas são encerradas pelo suporte. Fale com o suporte.';
  end if;

  if exists (
    select 1 from pousadas p
    where (
        p.owner_id = v_uid
        or exists (
          select 1 from memberships m
          where m.pousada_id = p.id and m.user_id = v_uid
            and m.role = 'proprietario' and m.status in ('active', 'suspended')
        )
      )
      and p.status not in ('arquivada', 'reprovada')
      and p.tenant_status <> 'inactive'
  ) then
    raise exception 'Transfira ou encerre sua pousada antes de excluir a conta. Fale com o suporte.';
  end if;

  if exists (
    select 1 from bookings b
    where (
        b.guest_id = v_uid
        or b.responsible_guest_id in (select g.id from guests g where g.user_id = v_uid)
      )
      and b.status in ('pending', 'confirmed', 'checked_in')
      and b.checkout >= pousada_local_date(b.pousada_id)
  ) then
    raise exception 'Você tem uma reserva em andamento. Cancele ou aguarde o fim da estadia antes de excluir a conta.';
  end if;

  -- (3) O que é só da pessoa.
  select lower(trim(u.email)) into v_email from auth.users u where u.id = v_uid;

  delete from traveler_profiles where user_id = v_uid;
  delete from favorite_alerts where user_id = v_uid;
  with d as (delete from favorites where user_id = v_uid returning 1)
  select count(*) into v_favorites from d;
  -- Vínculos de equipe e convites. Vínculo de proprietário de pousada já
  -- encerrada fica (é histórico da pousada) — aponta para a lápide anônima.
  with d as (
    delete from memberships
    where user_id = v_uid and (role <> 'proprietario' or status = 'invited')
    returning 1
  )
  select count(*) into v_memberships from d;
  if v_email is not null and v_email <> '' then
    delete from login_attempts where lower(email) = v_email;
    delete from password_reset_requests where lower(email) = v_email;
  end if;

  -- (5) Desvincula sem apagar: ficha e reserva são da pousada.
  with u as (update guests set user_id = null where user_id = v_uid returning 1)
  select count(*) into v_guests from u;
  with u as (update bookings set guest_id = null where guest_id = v_uid returning 1)
  select count(*) into v_bookings from u;

  -- (4) Lápide anônima.
  update profiles
     set full_name = 'Conta excluída',
         avatar_url = null,
         deleted_at = now(),
         updated_at = now()
   where id = v_uid;

  -- (7) Auditoria sem dado pessoal.
  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (v_uid, 'account.deleted', 'profiles', v_uid, jsonb_build_object(
    'bookingsUnlinked', v_bookings,
    'guestRecordsUnlinked', v_guests,
    'membershipsRemoved', v_memberships,
    'favoritesRemoved', v_favorites
  ));

  return jsonb_build_object('status', 'deleted');
end;
$$;

revoke all on function public.delete_my_account() from public, anon, service_role;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  '0090: o titular exclui a própria conta. Anonimiza e desvincula; nunca apaga reserva, pagamento, ficha, avaliação ou auditoria da pousada. O Auth é excluído (soft) pelo servidor depois.';
