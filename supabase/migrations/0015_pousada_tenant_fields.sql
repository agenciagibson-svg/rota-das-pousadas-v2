-- =============================================================================
-- Ciclo 2 — campos institucionais da pousada + status operacional do tenant.
-- Aditivo. Todos os defaults preservam o comportamento atual das 4 pousadas
-- já cadastradas (tenant_status 'active' = nenhuma perde acesso à gestão).
--
-- IMPORTANTE: `tenant_status` é DISTINTO de `pousada_status` (existente).
-- `pousada_status` (rascunho/em_analise/aprovada/publicada/suspensa/...)
-- controla a VISIBILIDADE PÚBLICA/moderação de conteúdo — não é tocado aqui,
-- então a área pública não é afetada. `tenant_status` controla se a equipe
-- pode USAR A ÁREA DE GESTÃO — é um conceito operacional novo e separado.
-- =============================================================================

create type tenant_status as enum ('onboarding', 'active', 'suspended', 'inactive');

alter table pousadas
  add column if not exists tenant_status tenant_status not null default 'active',
  add column if not exists legal_name text not null default '',
  add column if not exists tax_id text not null default '',
  add column if not exists whatsapp text not null default '',
  add column if not exists address text not null default '',
  add column if not exists country text not null default 'BR',
  add column if not exists timezone text not null default 'America/Sao_Paulo',
  add column if not exists currency text not null default 'BRL',
  add column if not exists language text not null default 'pt-BR';

create index if not exists idx_pousadas_tenant_status on pousadas(tenant_status);

-- Decisão de reuso de dado (evita duas fontes de verdade para e-mail de
-- contato): o e-mail institucional da pousada é o `notification_email` já
-- existente (usado hoje pela área pública/reservas). Não duplicado aqui.
