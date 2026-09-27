import { can, type Action, type Role } from './rbac'

/**
 * Quem acessa cada área do painel da pousada. Mesma fonte para o menu (só
 * mostra o que a pessoa pode abrir) e para a guarda de cada página (mostra
 * "sem acesso" em vez de quebrar com erro genérico). Basta UMA das ações.
 */
export type DashboardSection =
  | 'overview'
  | 'reservas'
  | 'nova_reserva'
  | 'hospedes'
  | 'financeiro'
  | 'acomodacoes'
  | 'categorias'
  | 'bloqueios'
  | 'disponibilidade'
  | 'canais'
  | 'link'
  | 'membros'
  | 'mensagens'
  | 'avaliacoes'
  | 'marketing'
  | 'assistente'
  | 'configuracoes'
  | 'pedidos'
  | 'estoque'

export const SECTION_ACCESS: Record<DashboardSection, Action[] | null> = {
  overview: null,
  reservas: ['booking:manage', 'payment:register'],
  nova_reserva: ['booking:manage'],
  hospedes: ['guest:manage'],
  financeiro: ['finance:pousada:view'],
  acomodacoes: ['room:manage', 'room:status:view'],
  categorias: ['category:manage', 'room:status:view'],
  bloqueios: ['room:block:view'],
  disponibilidade: ['availability:check'],
  canais: ['channel:view'],
  link: ['link:report:view'],
  membros: ['member:view'],
  mensagens: ['booking:manage'],
  avaliacoes: ['review:respond'],
  marketing: ['pousada:edit'],
  assistente: ['pousada:edit'],
  configuracoes: ['pousada:edit'],
  pedidos: ['order:manage'],
  estoque: ['inventory:view'],
}

export function canAccessSection(
  role: Role | null | undefined,
  section: DashboardSection,
): boolean {
  const needed = SECTION_ACCESS[section]
  if (!needed) return true
  if (!role) return false
  return needed.some((action) => can(role, action))
}

/** Seção de um link do menu (`/dashboard/...`). `null` = fora do painel da pousada. */
export function sectionForHref(href: string): DashboardSection | null {
  if (href === '/dashboard') return 'overview'
  const m = href.match(/^\/dashboard\/([a-z-]+)(?:\/([a-z-]+))?/)
  if (!m) return null
  const [, first, second] = m
  if (first === 'acomodacoes' && second && second in SECTION_ACCESS)
    return second as DashboardSection
  return first in SECTION_ACCESS ? (first as DashboardSection) : null
}
