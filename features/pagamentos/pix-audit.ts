/**
 * Auditoria dos comprovantes de Pix direto no /admin (0105).
 *
 * A pousada aprova o comprovante (o dinheiro cai na conta dela) e só então vê
 * o contato do hóspede. A Rota acompanha por aqui: todo comprovante do mês, de
 * todas as pousadas, com sinal para a reserva cancelada depois de o pagamento
 * ser aprovado — o caso em que vale perguntar o que aconteceu.
 */

export type PixProofStatus = 'submitted' | 'approved' | 'rejected'

export type PlatformPixAuditMonth = {
  /** `YYYY-MM-01`. */
  month: string
  total: number
  submitted: number
  approved: number
  rejected: number
  cancelledAfterApproval: number
}

export type PlatformPixAuditItem = {
  proofId: string
  bookingId: string
  bookingCode: string
  bookingStatus: string
  checkin: string
  checkout: string
  bookingTotal: number
  pousadaId: string
  pousadaName: string
  /** Valor informado pelo hóspede. */
  amount: number
  /** Valor que a pousada confirmou ao aprovar. */
  approvedAmount: number | null
  status: PixProofStatus
  createdAt: string
  reviewedAt: string | null
  rejectionReason: string | null
  cancelledAfterApproval: boolean
  /** Link temporário (10 min) para abrir o comprovante. */
  url: string | null
}

export type PlatformPixAudit = {
  month: string
  months: PlatformPixAuditMonth[]
  items: PlatformPixAuditItem[]
}

export const PIX_PROOF_STATUS_LABEL: Record<PixProofStatus, string> = {
  submitted: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Recusado',
}

/** Itens que pedem atenção primeiro: cancelada depois de aprovada, depois em análise. */
export function sortAuditItems(items: readonly PlatformPixAuditItem[]): PlatformPixAuditItem[] {
  const rank = (i: PlatformPixAuditItem) =>
    i.cancelledAfterApproval ? 0 : i.status === 'submitted' ? 1 : 2
  return [...items].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt))
}

/** Valor aprovado diferente do informado pelo hóspede (pagamento parcial ou ajuste). */
export function approvedDiffers(item: PlatformPixAuditItem): boolean {
  return (
    item.status === 'approved' &&
    item.approvedAmount !== null &&
    Math.abs(item.approvedAmount - item.amount) >= 0.01
  )
}
