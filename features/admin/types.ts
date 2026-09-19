import type { Season } from '@/types'

/** Pousada aguardando aprovação da curadoria. */
export type PendingPousada = {
  id: string
  slug: string
  name: string
  city: string
  state: string
  createdAt: string
}

/** Linha da tela "Pousadas" do admin — qualquer status, com nome do proprietário. */
export type AdminPousadaRow = {
  id: string
  slug: string
  name: string
  city: string
  state: string
  status: string
  image: string | null
  ownerName: string | null
  createdAt: string
}

/** Linha da tela "Anfitriões" do admin. */
export type PlatformHost = {
  userId: string
  fullName: string
  email: string
  pousadaId: string
  pousadaName: string
  pousadaSlug: string
  createdAt: string
}

/** KPIs do topo da Visão Geral — números reais, não mais fixos. */
export type PlatformKpis = {
  /** GMV (bookings.fee) do mês — dinheiro do hóspede que vai pra pousada, NÃO é receita da Rota. */
  gmvThisMonth: number
  gmvDeltaPct: number | null
  activePousadas: number
  bookingsThisMonth: number
  newHostsThisMonth: number
}

export type GmvMonthPoint = { month: string; amount: number }
export type RegionBookingCount = { state: string; count: number }

export type PlatformOverview = {
  kpis: PlatformKpis
  gmvByMonth: GmvMonthPoint[]
  bookingsByRegion: RegionBookingCount[]
  occupancyRate: number
  featuredDestinations: { slug: string; name: string; state: string; pousadas: number }[]
  featuredPousadas: {
    slug: string
    name: string
    city: string
    state: string
    image: string
    rating: number
  }[]
}

/**
 * Concessão de acesso institucional temporário da plataforma a dados
 * sensíveis (reservas/pagamentos/despesas) de uma pousada específica.
 * Ver supabase/migrations/0013_platform_access_grants.sql.
 */
export type PlatformAccessGrant = {
  id: string
  pousadaId: string
  grantedTo: string
  grantedBy: string | null
  reason: string
  grantedAt: string
  expiresAt: string
}

/** Linha da tela "Destinos" do admin — inclui `id` (editar/excluir) e `pousadasCount` calculado ao vivo. */
export type AdminDestinationRow = {
  id: string
  slug: string
  name: string
  state: string
  image: string
  season: Season[]
  rating: number
  priceFrom: number
  pousadasCount: number
}

/**
 * Papel de plataforma atribuível pela UI de Configurações — subconjunto de
 * `Role` (lib/auth/rbac.ts) que corresponde exatamente ao enum `platform_role`
 * do banco (migration 0001). Papéis de tenant (proprietario, etc.) nunca
 * passam por aqui — são atribuídos via membership, não platform_role.
 */
export type PlatformRoleValue =
  'suporte' | 'comercial' | 'marketing' | 'financeiro_plataforma' | 'master'

/** Membro da equipe de plataforma (tela "Configurações" — gestão de papéis). */
export type PlatformTeamMember = {
  userId: string
  fullName: string
  email: string
  platformRole: PlatformRoleValue
  createdAt: string
}

/** Linha da tela "Auditoria" — trilha de audit_log, plataforma inteira (só master lê). */
export type AuditLogEntry = {
  id: string
  actorName: string | null
  action: string
  targetTable: string | null
  targetId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}
