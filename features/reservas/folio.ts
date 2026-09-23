/**
 * Conta do hóspede (0069): consumo lançado por pedido e pagamentos — os do
 * Mercado Pago, que chegam pelo webhook, e os registrados no balcão. O saldo
 * é calculado no banco (`bookings.balance_due` = total + consumo − recebido).
 */
import { DEFAULT_TIMEZONE } from '@/lib/dates'
import type { BookingStatus } from './types'

/** Formas de pagamento registradas na pousada — as mesmas que o banco aceita. */
export const MANUAL_PAYMENT_METHODS = [
  'dinheiro',
  'pix',
  'cartao_credito',
  'cartao_debito',
] as const
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number]

export const MANUAL_PAYMENT_METHOD_LABEL: Record<ManualPaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
}

export type FolioCharge = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  createdAt: string
  cancelledAt: string | null
  cancellationReason: string | null
}

export type FolioPayment = {
  id: string
  source: 'mercadopago' | 'manual'
  method: string
  amount: number
  status: 'pendente' | 'aprovado' | 'recusado' | 'estornado'
  createdAt: string
  notes: string
  reversedAt: string | null
  reversalReason: string | null
}

export type BookingFolio = {
  charges: FolioCharge[]
  payments: FolioPayment[]
  /** `payment:register` — lançar consumo e registrar pagamento. */
  canRegister: boolean
  /** `payment:refund` — cancelar consumo e estornar pagamento manual. */
  canReverse: boolean
}

/** Consumo só em reserva confirmada, hospedada ou encerrada (0069). */
export function acceptsCharges(status: BookingStatus): boolean {
  return status === 'confirmed' || status === 'checked_in' || status === 'checked_out'
}

/** Pagamento no balcão também vale para a pendente (sinal ou quitação). */
export function acceptsPayments(status: BookingStatus): boolean {
  return status === 'pending' || acceptsCharges(status)
}

function isManualMethod(method: string): method is ManualPaymentMethod {
  return (MANUAL_PAYMENT_METHODS as readonly string[]).includes(method)
}

/** "PIX", "Dinheiro"… no balcão; "Mercado Pago" (· PIX) no que veio pelo site. */
export function paymentMethodLabel(payment: Pick<FolioPayment, 'source' | 'method'>): string {
  if (payment.source === 'manual') {
    return isManualMethod(payment.method)
      ? MANUAL_PAYMENT_METHOD_LABEL[payment.method]
      : payment.method
  }
  return payment.method === 'pix' ? 'Mercado Pago · PIX' : 'Mercado Pago'
}

/** R$ 1.234,50 — a conta tem centavos (consumo, pagamento parcial). */
export function formatBRL(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Data e hora de um lançamento no fuso da pousada — o mesmo texto no servidor
 * (UTC) e no navegador, sem divergência na hidratação. Fuso inválido cai em
 * Brasília.
 */
export function formatFolioDateTime(iso: string, timeZone: string): string {
  const options = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' } as const
  try {
    return new Intl.DateTimeFormat('pt-BR', { ...options, timeZone }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: DEFAULT_TIMEZONE }).format(
      new Date(iso),
    )
  }
}
