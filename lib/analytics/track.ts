/**
 * Eventos do funil de reserva para o Google Analytics 4.
 *
 * Só envia quando o GA4 foi carregado, o que só acontece com o
 * consentimento do visitante. Sem isso a chamada não faz nada. Nunca mande
 * nome, e-mail, telefone ou documento do hóspede.
 */
export type FunnelEvent =
  /** Abriu a página de uma pousada. */
  | 'view_item'
  /** Abriu o formulário de reserva. */
  | 'begin_checkout'
  /** A reserva foi criada e o hóspede chegou à tela de pagamento. */
  | 'reserva_criada'
  /** Enviou o comprovante do Pix ou foi para o pagamento com cartão. */
  | 'add_payment_info'

export type FunnelParams = {
  pousada_id?: string
  pousada_nome?: string
  cidade?: string
  /** Valor em reais. */
  value?: number
  currency?: 'BRL'
  metodo?: 'pix' | 'cartao'
}

type Gtag = (command: 'event', name: string, params?: Record<string, unknown>) => void

export function track(name: FunnelEvent, params: FunnelParams = {}): void {
  if (typeof window === 'undefined') return
  const gtag = (window as unknown as { gtag?: Gtag }).gtag
  if (typeof gtag !== 'function') return
  gtag('event', name, params)
}
