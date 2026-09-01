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
  | 'room:block:manage'
  | 'room:block:view'
  | 'availability:check'
  | 'booking:manage'
  | 'booking:no_show'

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
  comercial: ['catalog:view', 'search:run', 'pousada:approve', 'pousada:create', 'reports:global:view'],
  marketing: ['catalog:view', 'search:run', 'coupon:platform:create', 'content:moderate', 'reports:global:view'],
  financeiro_plataforma: ['catalog:view', 'search:run', 'reports:global:view'],
  master: [
    'catalog:view',
    'search:run',
    'favorite:manage',
    'booking:create',
    'booking:cancel',
    'payout:receive',
    'pousada:create',
    'pousada:edit',
    'pousada:delete',
    'pousada:approve',
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
    'room:block:manage',
    'room:block:view',
    'availability:check',
    'booking:manage',
    'booking:no_show',
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
