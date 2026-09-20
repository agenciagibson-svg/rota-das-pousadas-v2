/**
 * RBAC — controle de acesso baseado em papéis.
 *
 * Camada de AUTORIZAÇÃO na aplicação. Codifica a matriz de permissões do
 * documento de negócio (04_BUSINESS_ARCHITECTURE §7). É a primeira das DUAS
 * barreiras de segurança; a segunda é a RLS no Postgres (ver migrations).
 *
 * Funções puras — sem I/O, sem React, sem HTTP. Totalmente testável.
 */

export type Role =
  | 'visitante'
  | 'viajante'
  | 'proprietario'
  | 'admin_pousada'
  | 'recepcionista'
  | 'financeiro_pousada'
  | 'governanca'
  | 'suporte'
  | 'comercial'
  | 'marketing'
  | 'financeiro_plataforma'
  | 'master'
  | 'ia'

export type Action =
  | 'catalog:view'
  | 'search:run'
  | 'favorite:manage'
  | 'booking:create'
  | 'booking:cancel'
  | 'payment:pay'
  | 'payout:receive'
  | 'pousada:create'
  | 'pousada:edit'
  | 'pousada:delete'
  | 'pousada:approve'
  | 'pousada:link_owner'
  | 'room:manage'
  | 'calendar:manage'
  | 'pricing:manage'
  | 'coupon:platform:create'
  | 'review:respond'
  | 'content:moderate'
  | 'checkin:perform'
  | 'checkout:perform'
  | 'guest:manage'
  | 'room:status:view'
  | 'room:status:manage'
  | 'housekeeping:manage'
  | 'payment:register'
  | 'payment:refund'
  | 'finance:pousada:view'
  | 'reports:global:view'
  | 'users:manage'
  | 'member:view'
  | 'member:invite'
  | 'member:update_role'
  | 'member:suspend'
  | 'member:revoke'
  | 'platform:configure'
  | 'platform:grant:manage'
  | 'audit:view'
  | 'category:manage'
  // Catálogo de destinos (curadoria da home) — comercial/marketing/master,
  // mesmo escopo de quem hoje aprova/cadastra pousada. Espelha
  // `auth_can_manage_destinations` na migration 0054.
  | 'destination:manage'
  // Contas a pagar da própria Rota (não confundir com 'finance:pousada:view',
  // que é o financeiro de CADA pousada). Espelha
  // `auth_can_manage_platform_finance` na migration 0055 — só
  // financeiro_plataforma/master, dado interno sensível.
  | 'platform_finance:manage'
  | 'room:block:manage'
  | 'room:block:view'
  | 'availability:check'
  | 'booking:manage'
  | 'booking:no_show'
  | 'payment:connect_account'
  // Assinatura da PLATAFORMA (Mercado Pago Assinaturas) — a receita real da
  // Rota, não confundir com 'payment:connect_account' (conta MP da própria
  // pousada, usada nos pagamentos de hóspede). Concedida a proprietario
  // (assina em nome da pousada) e master (suporte).
  | 'subscription:manage'
  // Canais (iCal com Airbnb/Booking). `manage` espelha exatamente
  // `auth_can_manage_channels` e `view` espelha `auth_can_read_channels`, ambos
  // na migration 0044 — as duas barreiras precisam concordar, senão a tela
  // oferece um botão que o banco recusa.
  | 'channel:view'
  | 'channel:manage'
  // Link da bio. Ambas espelham `auth_has_guest_access` (0030), que é o que
  // a RLS da 0046 usa para o relatório e para os pedidos de orçamento.
  | 'link:report:view'
  | 'quote:manage'

/** Papéis que operam no escopo de uma pousada (tenant). */
export const TENANT_ROLES: readonly Role[] = [
  'proprietario',
  'admin_pousada',
  'recepcionista',
  'financeiro_pousada',
  'governanca',
] as const

/** Papéis internos da plataforma. */
export const PLATFORM_ROLES: readonly Role[] = [
  'suporte',
  'comercial',
  'marketing',
  'financeiro_plataforma',
  'master',
] as const

/**
 * Matriz papel → ações permitidas. Reflete a §7 do documento de negócio.
 * `master` recebe todas as ações; ações irreversíveis exigem, além disso,
 * auditoria/aprovação na camada de serviço.
 */
const MATRIX: Record<Role, Action[]> = {
  visitante: ['catalog:view', 'search:run'],
  viajante: ['catalog:view', 'search:run', 'favorite:manage', 'booking:create', 'payment:pay'],
  proprietario: [
    'catalog:view',
    'search:run',
    'payout:receive',
    'payment:connect_account',
    'subscription:manage',
    'pousada:create',
    'pousada:edit',
    'pousada:delete',
    'room:manage',
    'calendar:manage',
    'pricing:manage',
    'review:respond',
    'checkin:perform',
    'checkout:perform',
    'guest:manage',
    'room:status:view',
    'room:status:manage',
    'housekeeping:manage',
    'payment:register',
    'payment:refund',
    'finance:pousada:view',
    'users:manage',
    'member:view',
    'member:invite',
    'member:update_role',
    'member:suspend',
    'member:revoke',
    'audit:view',
    'category:manage',
    'room:block:manage',
    'room:block:view',
    'availability:check',
    'booking:manage',
    'booking:cancel',
    'booking:no_show',
    'channel:view',
    'channel:manage',
    'link:report:view',
    'quote:manage',
  ],
  // Property manager: opera o dia a dia da pousada, mas administração de
  // equipe é sensível e fica restrita ao proprietário (decisão do Ciclo 1).
  admin_pousada: [
    'catalog:view',
    'search:run',
    'pousada:edit',
    'room:manage',
    'calendar:manage',
    'pricing:manage',
    'review:respond',
    'checkin:perform',
    'checkout:perform',
    'guest:manage',
    'room:status:view',
    'room:status:manage',
    'housekeeping:manage',
    'payment:register',
    'payment:refund',
    'finance:pousada:view',
    'member:view',
    'category:manage',
    'room:block:manage',
    'room:block:view',
    'availability:check',
    'booking:manage',
    'booking:cancel',
    'booking:no_show',
    'channel:view',
    'channel:manage',
    'link:report:view',
    'quote:manage',
  ],
  recepcionista: [
    'catalog:view',
    'search:run',
    'calendar:manage',
    'checkin:perform',
    'checkout:perform',
    'guest:manage',
    'room:status:view',
    'payment:register',
    'room:block:view',
    'availability:check',
    'booking:manage',
    'booking:cancel',
    'booking:no_show',
    'channel:view',
    'link:report:view',
    'quote:manage',
  ],
  financeiro_pousada: [
    'catalog:view',
    'search:run',
    'finance:pousada:view',
    'payment:register',
    'payment:refund',
  ],
  // Governança/limpeza: só status operacional da acomodação — nunca valores,
  // documentos pessoais ou dados financeiros (item 4 do escopo de negócio).
  governanca: ['room:status:view', 'room:status:manage', 'housekeeping:manage', 'room:block:view'],
  suporte: [
    'catalog:view',
    'search:run',
    'booking:cancel',
    'review:respond',
    'content:moderate',
    'finance:pousada:view',
    'reports:global:view',
    'audit:view',
  ],
  comercial: [
    'catalog:view',
    'search:run',
    'pousada:approve',
    'pousada:create',
    'pousada:link_owner',
    'reports:global:view',
    'destination:manage',
  ],
  marketing: [
    'catalog:view',
    'search:run',
    'coupon:platform:create',
    'content:moderate',
    'reports:global:view',
    'destination:manage',
  ],
  financeiro_plataforma: [
    'catalog:view',
    'search:run',
    'reports:global:view',
    'platform_finance:manage',
  ],
  master: [
    'catalog:view',
    'search:run',
    'favorite:manage',
    'booking:create',
    'booking:cancel',
    'payout:receive',
    'payment:connect_account',
    'subscription:manage',
    'pousada:create',
    'pousada:edit',
    'pousada:delete',
    'pousada:approve',
    'pousada:link_owner',
    'room:manage',
    'calendar:manage',
    'pricing:manage',
    'coupon:platform:create',
    'review:respond',
    'content:moderate',
    'checkin:perform',
    'checkout:perform',
    'guest:manage',
    'room:status:view',
    'room:status:manage',
    'housekeeping:manage',
    'payment:register',
    'payment:refund',
    'finance:pousada:view',
    'reports:global:view',
    'users:manage',
    'member:view',
    'member:invite',
    'member:update_role',
    'member:suspend',
    'member:revoke',
    'platform:configure',
    'platform:grant:manage',
    'audit:view',
    'category:manage',
    'destination:manage',
    'platform_finance:manage',
    'room:block:manage',
    'room:block:view',
    'availability:check',
    'booking:manage',
    'booking:no_show',
    'channel:view',
    'channel:manage',
    'link:report:view',
    'quote:manage',
  ],
  // A IA só triagem/sugestão; ações efetivas passam por humano (ver AIService).
  ia: ['catalog:view', 'search:run', 'content:moderate'],
}

/** Retorna true se o papel pode executar a ação. */
export function can(role: Role, action: Action): boolean {
  return MATRIX[role]?.includes(action) ?? false
}

/** Retorna true se algum dos papéis do usuário permite a ação. */
export function canAny(roles: Role[], action: Action): boolean {
  return roles.some((r) => can(r, action))
}

export function isTenantRole(role: Role): boolean {
  return TENANT_ROLES.includes(role)
}

export function isPlatformRole(role: Role): boolean {
  return PLATFORM_ROLES.includes(role)
}
