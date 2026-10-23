/**
 * Avisos do sino do painel da pousada (puro, sem I/O).
 *
 * Cada aviso aponta para uma tarefa que alguém da pousada precisa fazer. Só
 * entra aviso com contagem real maior que zero: o sino nunca acende sem motivo
 * (antes ele tinha um ponto fixo, sempre aceso, e não abria nada).
 *
 * Uma fonte `null` significa "este papel não vê isso" ou "a consulta falhou" —
 * nos dois casos o aviso simplesmente não aparece.
 */

export type NoticeTone = 'urgent' | 'action' | 'info'

export type Notice = {
  id: string
  tone: NoticeTone
  title: string
  detail?: string
  href: string
}

export type NoticeSources = {
  /** Comprovantes Pix enviados pelo hóspede, aguardando a pousada conferir. */
  proofsToReview: number | null
  /** Pagamentos que pedem revisão (ex.: pago depois de a reserva expirar). */
  paymentReviews: number | null
  /** Reservas em `pending` ainda sem comprovante. */
  pendingBookings: number | null
  /** Chegadas de hoje que ainda não fizeram check-in. */
  arrivalsToday: number | null
  /** Chegadas dos próximos 3 dias sem ficha (pré-check-in) preenchida. */
  arrivalsWithoutPrecheckin: number | null
  /** Pedidos novos do app da estadia. */
  newOrders: number | null
  /** Itens de estoque no mínimo ou abaixo. */
  lowStock: number | null
  /** Canais (Airbnb/Booking) cuja última sincronização falhou. */
  channelErrors: number | null
  /** Configuração guiada: passos obrigatórios que faltam. */
  setupMissing: number | null
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many
}

const TONE_ORDER: Record<NoticeTone, number> = { urgent: 0, action: 1, info: 2 }

export function buildNotices(s: NoticeSources): Notice[] {
  const out: Notice[] = []
  const has = (n: number | null): n is number => typeof n === 'number' && n > 0

  if (has(s.paymentReviews)) {
    out.push({
      id: 'payment-reviews',
      tone: 'urgent',
      title: `${s.paymentReviews} ${plural(s.paymentReviews, 'pagamento precisa', 'pagamentos precisam')} de revisão`,
      detail: 'Dinheiro recebido que não bate com a reserva.',
      href: '/dashboard',
    })
  }
  if (has(s.channelErrors)) {
    out.push({
      id: 'channel-errors',
      tone: 'urgent',
      title: `${s.channelErrors} ${plural(s.channelErrors, 'canal não sincronizou', 'canais não sincronizaram')}`,
      detail: 'Reservas do Airbnb ou Booking podem não estar bloqueando o quarto.',
      href: '/dashboard/acomodacoes/canais',
    })
  }
  if (has(s.proofsToReview)) {
    out.push({
      id: 'proofs',
      tone: 'action',
      title: `${s.proofsToReview} ${plural(s.proofsToReview, 'comprovante Pix', 'comprovantes Pix')} para aprovar`,
      detail: 'Confira na conta e aprove para confirmar a reserva.',
      href: '/dashboard/reservas',
    })
  }
  if (has(s.newOrders)) {
    out.push({
      id: 'orders',
      tone: 'action',
      title: `${s.newOrders} ${plural(s.newOrders, 'pedido novo', 'pedidos novos')} do app da estadia`,
      href: '/dashboard/pedidos',
    })
  }
  if (has(s.arrivalsToday)) {
    out.push({
      id: 'arrivals',
      tone: 'action',
      title: `${s.arrivalsToday} ${plural(s.arrivalsToday, 'chegada', 'chegadas')} hoje`,
      href: '/dashboard',
    })
  }
  if (has(s.pendingBookings)) {
    out.push({
      id: 'pending',
      tone: 'info',
      title: `${s.pendingBookings} ${plural(s.pendingBookings, 'reserva aguardando', 'reservas aguardando')} pagamento`,
      href: '/dashboard/reservas',
    })
  }
  if (has(s.arrivalsWithoutPrecheckin)) {
    out.push({
      id: 'precheckin',
      tone: 'info',
      title: `${s.arrivalsWithoutPrecheckin} ${plural(s.arrivalsWithoutPrecheckin, 'chegada', 'chegadas')} sem ficha preenchida`,
      detail: 'Próximos 3 dias. Envie o link do pré-check-in pelo WhatsApp.',
      href: '/dashboard/reservas',
    })
  }
  if (has(s.lowStock)) {
    out.push({
      id: 'stock',
      tone: 'info',
      title: `${s.lowStock} ${plural(s.lowStock, 'item acabando', 'itens acabando')} no estoque`,
      href: '/dashboard/estoque',
    })
  }
  if (has(s.setupMissing)) {
    out.push({
      id: 'setup',
      tone: 'info',
      title: `Configuração da pousada: ${plural(s.setupMissing, 'falta 1 passo', `faltam ${s.setupMissing} passos`)}`,
      href: '/dashboard',
    })
  }

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
}

/** Quantos avisos pedem ação (o número do sino). Informativos não contam. */
export function noticeBadgeCount(notices: Notice[]): number {
  return notices.filter((n) => n.tone !== 'info').length
}
