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
  revenueThisMonth: number
  revenueDeltaPct: number | null
  activePousadas: number
  bookingsThisMonth: number
  newHostsThisMonth: number
}

export type RevenueMonthPoint = { month: string; amount: number }
export type RegionBookingCount = { state: string; count: number }

export type PlatformOverview = {
  kpis: PlatformKpis
  revenueByMonth: RevenueMonthPoint[]
  bookingsByRegion: RegionBookingCount[]
  occupancyRate: number
  featuredDestinations: { slug: string; name: string; state: string; pousadas: number }[]
  featuredPousadas: { slug: string; name: string; city: string; state: string; image: string; rating: number }[]
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
