import type { Season } from '@/types'
import type {
  BillingMetrics,
  CashFlowMonthPoint,
} from '@/features/pagamentos/services/billing-metrics'

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
  ownerEmail: string | null
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

/**
 * Desempenho por pousada nos últimos 90 dias — achado da análise de
 * 19/09/2026: faltava um jeito de ver quais pousadas publicadas estão
 * captando (GMV/reservas/ocupação) e quais estão "sem resultado". `noResult`
 * só marca pousadas publicadas há mais de 30 dias (carência pra anúncio
 * novo) e com zero reservas reais na janela.
 */
export type PousadaPerformance = {
  id: string
  slug: string
  name: string
  city: string
  state: string
  gmv: number
  bookingsCount: number
  occupancyRate: number
  createdAt: string
  noResult: boolean
}

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

/** Linha do relatório de login — `list_login_attempts` (0057) já devolve o IP mascarado. */
export type LoginAttemptRow = {
  id: string
  email: string
  ipMasked: string | null
  success: boolean
  createdAt: string
}

export type PlatformExpenseCategory =
  'infraestrutura' | 'pessoal' | 'marketing' | 'impostos' | 'juridico' | 'outros'

/** Espelho do tipo de `billing-metrics.ts`, só pra manter os imports do admin autocontidos. */
export type { BillingMetrics, CashFlowMonthPoint }

export type SubscriptionStatusValue = 'pending' | 'authorized' | 'paused' | 'cancelled'

/** Linha da tela "Contas a receber" — assinatura não cancelada, com o nome já resolvido. */
export type ReceivableSubscription = {
  pousadaId: string
  pousadaName: string
  planName: string
  amount: number
  status: SubscriptionStatusValue
  nextBillingDate: string | null
}

export type InvoiceStatusValue = 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled'

/** Linha da tela "Faturas recentes" — fatura de assinatura, com o nome da pousada já resolvido. */
export type InvoiceRecord = {
  id: string
  pousadaName: string
  amount: number
  status: InvoiceStatusValue
  periodStart: string | null
  periodEnd: string | null
  paidAt: string | null
}

/** Conta a pagar da própria Rota — tela "Financeiro" do painel master. Não confundir com
 * `Expense` (features/financeiro/types.ts), que é a despesa de CADA pousada. */
export type PlatformExpense = {
  id: string
  description: string
  amount: number
  category: PlatformExpenseCategory
  dueDate: string | null
  paid: boolean
  createdAt: string
}
