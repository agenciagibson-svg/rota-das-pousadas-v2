-- =============================================================================
-- Ciclo 2 — Fase 1 do sistema de gestão: ciclo de vida do vínculo (membership).
-- Aditivo — nenhuma linha ou tabela existente é removida.
--
-- Hoje `memberships` não distingue um vínculo ativo de um convite pendente ou
-- de um acesso suspenso/revogado — qualquer linha concede acesso pleno. Esta
-- migration adiciona o status e os campos de rastreabilidade exigidos pelo
-- Ciclo 2 (item 2 e item 11 do escopo de negócio).
-- =============================================================================

create type membership_status as enum ('invited', 'active', 'suspended', 'revoked');

alter table memberships
  add column if not exists status membership_status not null default 'active',
  add column if not exists invited_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references profiles(id),
  add column if not exists suspended_by uuid references profiles(id),
  add column if not exists suspended_reason text;

create index if not exists idx_memberships_status on memberships(status);

-- O unique original (user_id, pousada_id) impediria reconvidar alguém após
-- revogação. Substitui por um índice parcial: só um vínculo NÃO revogado por
-- par usuário/pousada — permite reemitir convite depois de revogar o antigo.
alter table memberships drop constraint if exists memberships_user_id_pousada_id_key;
create unique index if not exists idx_memberships_active_unique
  on memberships(user_id, pousada_id)
  where status <> 'revoked';
