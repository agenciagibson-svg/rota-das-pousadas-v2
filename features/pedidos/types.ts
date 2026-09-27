export type OrderStatus = 'novo' | 'preparando' | 'entregue' | 'cancelado'

export type OrderLine = {
  itemId: string | null
  name: string
  unit: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export type GuestOrder = {
  id: string
  bookingId: string
  bookingCode: string
  guestName: string
  roomName: string
  status: OrderStatus
  source: 'hospede' | 'equipe'
  note: string
  total: number
  lines: OrderLine[]
  createdAt: string
  acceptedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
}

export type ConsumptionSummary = {
  delivered: number
  open: number
  paid: number
  balance: number
}

export type ConsumptionPayment = {
  id: string
  amount: number
  method: 'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'outro'
  note: string
  createdAt: string
}

export type GuestSettings = {
  wifiName: string
  wifiPassword: string
  guestInfo: string
  ordersEnabled: boolean
  ordersHours: string
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  novo: 'Novo',
  preparando: 'Em preparo',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export const PAYMENT_METHOD_LABEL: Record<ConsumptionPayment['method'], string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  outro: 'Outro',
}

export function toSummary(raw: {
  delivered: number | string
  open: number | string
  paid: number | string
}): ConsumptionSummary {
  const delivered = Number(raw.delivered) || 0
  const paid = Number(raw.paid) || 0
  return { delivered, open: Number(raw.open) || 0, paid, balance: Math.max(0, delivered - paid) }
}
