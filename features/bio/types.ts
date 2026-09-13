/** Link da bio — relatório do painel e pedidos de orçamento. */

export type QuoteRequestStatus = 'novo' | 'respondido' | 'convertido' | 'descartado'

export type QuoteRequest = {
  id: string
  name: string
  email: string | null
  phone: string
  checkin: string | null
  checkout: string | null
  adults: number
  children: number
  pets: boolean
  occasion: string
  message: string
  status: QuoteRequestStatus
  internalNotes: string
  handledAt: string | null
  createdAt: string
}

export type LinkReportTotals = {
  views: number
  searches: number
  /** Buscas em que nenhuma acomodação atendia ao pedido — demanda perdida. */
  searchesWithoutAvailability: number
  quotes: number
  bookings: number
  revenue: number
}

export type LinkReportDay = {
  day: string
  views: number
  searches: number
  bookings: number
}

/** Um período que foi procurado e não tinha vaga. */
export type UnmetDemand = {
  checkin: string
  checkout: string | null
  guests: number
  tries: number
}

export type LinkReport = {
  days: number
  from: string
  totals: LinkReportTotals
  daily: LinkReportDay[]
  unmetDemand: UnmetDemand[]
}

export const QUOTE_STATUS_LABEL: Record<QuoteRequestStatus, string> = {
  novo: 'Novo',
  respondido: 'Respondido',
  convertido: 'Virou reserva',
  descartado: 'Descartado',
}

/** Estado da página pública, decidido no servidor. */
export type BioPageState = 'preparando' | 'no_ar'
